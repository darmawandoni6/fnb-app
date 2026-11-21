package repository

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"fnb-server/internal/domain"
)

type MidtransClient struct {
	serverKey string
	baseURL   string
	client    *http.Client
}

func NewMidtransClient(serverKey string, isProduction bool) *MidtransClient {
	baseURL := "https://app.sandbox.midtrans.com/snap/v1/transactions"
	if isProduction {
		baseURL = "https://app.midtrans.com/snap/v1/transactions"
	}
	return &MidtransClient{
		serverKey: serverKey,
		baseURL:   baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type midtransSnapPayload struct {
	TransactionDetails struct {
		OrderID     string `json:"order_id"`
		GrossAmount int64  `json:"gross_amount"`
	} `json:"transaction_details"`
	ItemDetails     []midtransItemDetail `json:"item_details"`
	CustomerDetails struct {
		FirstName string `json:"first_name"`
		Phone     string `json:"phone,omitempty"`
	} `json:"customer_details"`
	CustomField1 string `json:"custom_field1"`
}

type midtransItemDetail struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
}

type midtransSnapResponse struct {
	Token         string   `json:"token"`
	RedirectURL   string   `json:"redirect_url"`
	ErrorMessages []string `json:"error_messages,omitempty"`
}

func (c *MidtransClient) CreateSnap(ctx context.Context, req domain.SnapRequest) (*domain.SnapResponse, error) {
	if c.serverKey == "" {
		return nil, domain.ErrGatewayUnavailable
	}

	payload := midtransSnapPayload{}
	payload.TransactionDetails.OrderID = req.OrderNumber
	payload.TransactionDetails.GrossAmount = req.GrossAmount
	payload.CustomerDetails.FirstName = req.Customer.Name
	payload.CustomerDetails.Phone = req.Customer.Phone
	payload.CustomField1 = req.OrderID.String()

	payload.ItemDetails = make([]midtransItemDetail, len(req.Items))
	for i, it := range req.Items {
		payload.ItemDetails[i] = midtransItemDetail{
			ID:       it.ID,
			Name:     it.Name,
			Price:    it.Price,
			Quantity: it.Quantity,
		}
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal snap payload: %w", err)
	}

	authHeader := "Basic " + base64.StdEncoding.EncodeToString([]byte(c.serverKey+":"))

	var resp *http.Response
	var reqErr error

	for attempt := 0; attempt < 2; attempt++ {
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, fmt.Errorf("create snap request: %w", err)
		}
		httpReq.Header.Set("Authorization", authHeader)
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json")

		resp, reqErr = c.client.Do(httpReq)
		if reqErr == nil {
			break
		}
	}

	if reqErr != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrGatewayUnavailable, reqErr)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read snap response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("%w: status %d body %s", domain.ErrGatewayUnavailable, resp.StatusCode, string(respBody))
	}

	var snapRes midtransSnapResponse
	if err := json.Unmarshal(respBody, &snapRes); err != nil {
		return nil, fmt.Errorf("unmarshal snap response: %w", err)
	}

	return &domain.SnapResponse{
		Token:       snapRes.Token,
		RedirectURL: snapRes.RedirectURL,
	}, nil
}
