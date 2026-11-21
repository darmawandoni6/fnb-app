package dto

type MidtransCallbackResponse struct {
	Status string `json:"status"`
}

type MidtransCallbackRequest struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
	TransactionStatus string `json:"transaction_status"`
	TransactionID     string `json:"transaction_id"`
	FraudStatus       string `json:"fraud_status"`
}

func (r MidtransCallbackRequest) FormValue(form func(string) string) MidtransCallbackRequest {
	return MidtransCallbackRequest{
		OrderID:           form("order_id"),
		StatusCode:        form("status_code"),
		GrossAmount:       form("gross_amount"),
		SignatureKey:      form("signature_key"),
		TransactionStatus: form("transaction_status"),
		TransactionID:     form("transaction_id"),
		FraudStatus:       form("fraud_status"),
	}
}
