# PRD — FnB-App (Self-Service Order & Kasir Take Away)

## 1. Overview

### 1.1 Latar Belakang

FnB-App adalah aplikasi restoran untuk memungkinkan customer melakukan self-service order (dine-in via scan QR meja) dan order take away via kasir. Aplikasi mendukung pembayaran cash dan non-cash (Midtrans), serta integrasi status order antara customer, kasir, kitchen, dan owner. Waiter tidak menggunakan aplikasi — mengikuti SOP manual.

### 1.2 Tujuan Produk

- Mempercepat proses order tanpa harus menunggu waiter.
- Menyediakan alur pembayaran cash yang terkonfirmasi oleh kasir.
- Menyinkronkan status order antara customer, kasir, kitchen, dan owner secara real-time.
- Menghitung pajak & service charge otomatis di setiap order.
- Menjaga operasional tetap sederhana: 3 aplikasi, waiter cukup SOP.

### 1.3 Scope

- Single outlet.
- Dine-in (QR meja) & Take away (kasir).
- Pembayaran cash & non-cash (Midtrans Snap).
- Manajemen status order & item oleh kitchen, kasir, owner.
- Perhitungan pajak (PB1) & service charge.
- Role owner, kasir, kitchen (RBAC di dashboard).
- Struk fisik thermal untuk take away.
- Auto-complete & auto-deliver fallback.
- Cancel order hanya saat belum dibayar.

### 1.4 Out of Scope (v1)

- Multi-outlet.
- Loyalty / promo / voucher.
- Delivery (ojek online).
- Aplikasi waiter (waiter pakai SOP manual).
- Role manager terpisah (v1 cukup owner; manager Fase 2).
- **Refund item setelah bayar** — handle manual di luar sistem (Fase 2).
- **Cancel item parsial** — tidak ada (cancel = seluruh order).
- **Cancel order setelah bayar** — tidak ada (handle manual owner).
- Struk digital (WA/email) — Fase 2.
- Notifikasi WA/push ke customer — Fase 2 (field nomor HP disiapkan opsional).

---

## 2. Struktur Aplikasi (3 Aplikasi)

### 2.1 BE Service

- REST API + WebSocket (real-time status).
- Auth JWT untuk dashboard (owner/kasir/kitchen).
- Session token untuk customer QR (tanpa login).
- Integrasi Midtrans (Snap + webhook idempotent).
- Job scheduler: auto-cancel (1 menit), auto-deliver fallback (1 menit), auto-complete (1 menit).
- Printer service thermal (take away).
- Audit log.

### 2.2 Dashboard (Web, RBAC)

- **Role Owner**: setting outlet, laporan, audit log, kelola user & role, batalkan order (belum bayar), konfirmasi cash.
- **Role Kasir**: order take away, konfirmasi cash, cetak struk, update deliver take away.
- **Role Kitchen**: 2 tab — "Masak" (pending→cooking→ready) & "Pass/Counter" (ready→delivered, override completed).
- Login via JWT; menu berbeda per role.

### 2.3 App Menu (Web mobile-first, Customer)

- Scan QR meja → buka sesi (session token).
- Lihat menu, keranjang, input nama (wajib) + nomor HP (opsional).
- Pilih bayar cash / non-cash (Midtrans Snap).
- Lihat status order & item real-time.
- Tambah order baru di sesi yang sama.
- Tanpa login.

---

## 3. Aktor & Peran

- **Customer** — Pengunjung dine-in, scan QR meja. Akses: App Menu (tanpa login, session token; nama wajib, nomor HP opsional).
- **Kasir** — Buat order take away, konfirmasi bayar cash, serahkan pesanan take away, cetak struk. Akses: Dashboard (login).
- **Kitchen** — Update status masakan (pending→cooking→ready) & serah-terima ke waiter (ready→delivered, override completed). Akses: Dashboard (login).
- **Owner** — Kelola order, batalkan order (belum bayar), setting pajak/service, kelola user, lihat audit. Akses: Dashboard (login).
- **Waiter** — TIDAK punya aplikasi. Mengikuti SOP-WAITER-01 (ambil item ready dari counter, antar ke meja). Tidak ada akses sistem.

---

## 4. Alur Bisnis Utama

### 4.1 Flow Order Kasir (Take Away)

1. Login kasir
2. Pilih menu (multi-item + qty)
3. Review keranjang → subtotal, service, pajak, grand total
4. Input nama customer (opsional, default "Take Away")
5. Pilih metode pembayaran
   - NON-CASH → Midtrans Snap → sukses → order "diproses"
   - CASH → order "menunggu" + QR + nomor order → kasir terima uang → konfirmasi → order "diproses"
6. Pop up "Order Berhasil" + nomor order + cetak struk thermal
7. Kitchen masak (pending → cooking → ready)
8. Kasir serahkan pesanan → item ready → delivered → completed (langsung, tanpa waiter)
9. Semua item completed/canceled → order "selesai"

### 4.2 Flow Order QR Meja (Dine In)

1. Scan QR meja → buka sesi meja (table session + session token)
2. Pilih menu (multi-item)
3. Review keranjang → subtotal, service, pajak, grand total
4. Input nama customer (wajib) + nomor HP (opsional)
5. Pilih metode pembayaran
   - NON-CASH → Midtrans Snap → bayar → order "diproses"
   - CASH → order "menunggu" + QR + timer 15 menit → customer ke kasir → kasir konfirmasi → order "diproses"
6. Pop up "Order Berhasil"
7. Kitchen masak (pending → cooking → ready)
8. Kitchen tab Pass/Counter → tandai ready → delivered saat serahkan ke waiter
9. Waiter antar ke meja (SOP manual, tanpa sistem)
10. Auto 5 menit (atau override kitchen) → delivered → completed
11. Semua item completed/canceled → order "selesai"
12. Customer bisa tambah order → order baru di sesi yang sama

### 4.3 Flow Cash (Konfirmasi Kasir)

1. Customer pilih cash → Order "menunggu" + QR(order_id) + order_number
2. Timer 15 menit mulai
3. Customer ke kasir
4. Kasir scan QR / input order_number
5. Kasir lihat detail + grand total
6. Kasir input uang diterima → hitung kembalian
7. Kasir klik "Konfirmasi Pembayaran" (idempotent)
8. Order "diproses" + item "pending"
9. Notifikasi customer (layar)
10. Jika timeout → order "dibatalkan"

### 4.4 Flow Kitchen (Dashboard — 2 Tab)

1. Login kitchen
2. **Tab "Masak"**: lihat item pending → update cooking → ready
3. **Tab "Pass/Counter"**: lihat item ready → tandai delivered saat serahkan ke waiter (dine-in) / ke kasir (take away)
4. Item delivered → auto 5 menit → completed (kitchen bisa override completed lebih awal)
5. Jika kitchen lupa tandai delivered → auto-deliver fallback 10 menit (warning 2 menit sebelumnya)
6. Item hilang dari daftar aktif

### 4.5 Flow Waiter (SOP Manual — Bukan Sistem)

1. Waiter ambil item ready dari counter kitchen.
2. Kitchen tandai delivered di tab Pass/Counter.
3. Waiter antar ke meja customer.
4. Tidak ada aksi sistem oleh waiter.
5. Detail: lihat SOP-WAITER-01 (dokumen terpisah).

### 4.6 Flow Cancel Order (Belum Dibayar)

Cancel HANYA berlaku saat order status "menunggu" (belum dibayar). Tidak ada cancel setelah bayar, tidak ada cancel item parsial, tidak ada refund.

**Skenario A — Auto-cancel cash timeout (sistem):**

1. Order cash dibuat → status "menunggu" + timer 15 menit.
2. Customer tidak bayar dalam 15 menit → sistem auto-cancel.
3. Order → "dibatalkan", semua item → "canceled".
4. Notifikasi customer (layar).

**Skenario B — Midtrans expire (sistem):**

1. Order non-cash dibuat → Midtrans Snap.
2. Customer tidak bayar → Midtrans callback expire.
3. Sistem auto-cancel → order "dibatalkan", semua item "canceled".
4. Notifikasi customer (layar).

**Skenario C — Owner batalkan manual (belum bayar):**

1. Owner buka order status "menunggu".
2. Owner klik "Batalkan Order" + alasan.
3. Order → "dibatalkan", semua item → "canceled".
4. Notifikasi customer (layar).

**Aturan:**

- Cancel HANYA bisa saat order "menunggu" (belum dibayar).
- Order "diproses" (sudah bayar) TIDAK BISA dibatalkan di v1 — handle manual di luar sistem oleh owner.
- Tidak ada cancel item parsial. Cancel = seluruh order.
- Tidak ada refund di v1.

---

## 5. State Machine

### 5.1 Status Order

- menunggu — Order dibuat, belum dibayar (cash) / menunggu konfirmasi
- diproses — Pembayaran terkonfirmasi, order masuk kitchen
- selesai — Semua item berstatus completed atau canceled
- dibatalkan — Order dibatalkan saat belum dibayar (auto-cancel / Midtrans expire / owner)

Transisi Order:

- menunggu → diproses — Trigger: bayar non-cash sukses / kasir konfirmasi cash — Aktor: Sistem / Kasir
- menunggu → dibatalkan — Trigger: auto-cancel timeout 15 menit / Midtrans expire / owner — Aktor: Sistem / Owner
- diproses → selesai — Trigger: semua item terminal (completed/canceled) — Aktor: Sistem

Catatan: Transisi diproses → dibatalkan TIDAK ADA di v1 (cancel setelah bayar = handle manual di luar sistem).

### 5.2 Status Item (Kitchen & Auto)

Mapping status internal ke status customer:

| Status internal | Status customer   | Aktor transisi                                      |
| --------------- | ----------------- | --------------------------------------------------- |
| pending         | menunggu          | Sistem (order diproses)                             |
| cooking         | diproses          | Kitchen                                             |
| ready           | siap              | Kitchen                                             |
| delivered       | dalam pengantaran | Kitchen (tab Pass/Counter) / Kasir (take away)      |
| completed       | selesai           | Auto 5 menit / override Kitchen / Kasir (take away) |
| canceled        | batal             | Hanya saat order dibatalkan (massal)                |

Transisi Item:

- pending → cooking — Aktor: Kitchen
- cooking → ready — Aktor: Kitchen
- ready → delivered — Aktor: Kitchen (dine-in & take away serah ke kasir) — fallback auto 10 menit (warning 2 menit)
- delivered → completed — Aktor: Auto 5 menit / override Kitchen / Kasir (take away)
- pending → canceled — Aktor: Sistem/Owner, HANYA saat order dibatalkan (semua item canceled bersamaan)

Catatan: Transisi cooking/ready → canceled TIDAK ADA di v1 (tidak ada cancel parsial). Status customer diturunkan dari status item, bukan disimpan terpisah.

---

## 6. Perhitungan Pajak & Service Charge

Subtotal = Σ (harga_menu × qty)
Service Charge = Subtotal × service_rate (default 5%)
Pajak (PB1) = (Subtotal + Service) × tax_rate (default 10%)
Grand Total = Subtotal + Service + Pajak

Aturan:

- service_rate & tax_rate disimpan di setting outlet (configurable owner).
- Perhitungan disimpan snapshot di order (histori tidak berubah jika rate diubah).
- Pembulatan ke rupiah terdekat (round half up).
- Berlaku untuk semua order (cash & non-cash, kasir & QR).

---

## 7. Fitur Fungsional

### 7.1 Customer (App Menu — QR Meja)

- Scan QR meja → buka sesi meja.
- Lihat menu (kategori, harga, ketersediaan).
- Tambah menu ke keranjang (multi-item + qty).
- Input nama customer (wajib) + nomor HP (opsional).
- Pilih metode pembayaran (cash / non-cash).
- Lihat status order & item real-time.
- Tambah order baru di sesi meja yang sama.
- Notifikasi status via layar (WA/push → Fase 2).

### 7.2 Kasir (Dashboard)

- Login kasir.
- Buat order take away (multi-item).
- Review keranjang + perhitungan pajak/service.
- Proses pembayaran non-cash via Midtrans Snap.
- Konfirmasi pembayaran cash (scan QR / input nomor order + input uang + kembalian, idempotent).
- Update item ready → delivered → completed untuk take away.
- Cetak struk thermal take away.
- Lihat daftar order aktif.

### 7.3 Kitchen (Dashboard — 2 Tab)

- Login kitchen.
- **Tab "Masak"**: lihat item pending; update pending → cooking → ready; filter status/waktu.
- **Tab "Pass/Counter"**: lihat item ready; tandai ready → delivered (serah ke waiter/kasir); override delivered → completed; warning auto-deliver 2 menit sebelumnya.
- Lihat daftar item per meja / per nomor order.

### 7.4 Owner (Dashboard)

- Dashboard order (semua status).
- Batalkan order (hanya status "menunggu" / belum dibayar).
- Setting outlet: service_rate, tax_rate, cash_timeout_minutes, delivered_auto_complete_minutes (default 5), ready_auto_deliver_minutes (default 10), ready_auto_deliver_warning_minutes (default 2).
- Kelola user & role (owner/kasir/kitchen).
- Lihat audit log.
- Konfirmasi cash (backup kasir).

### 7.5 Sistem (Otomatis)

- Auto-cancel order cash yang tidak dibayar dalam 15 menit.
- Auto-cancel order non-cash saat Midtrans callback expire.
- Auto-deliver fallback: item ready > 10 menit → otomatis delivered (warning 2 menit sebelumnya ke kitchen).
- Auto-complete: item delivered > 5 menit → completed.
- Update order selesai saat semua item terminal.
- Kirim notifikasi status ke customer (layar; WA Fase 2).
- Snapshot harga menu, rate pajak/service di order.
- Generate nomor order atomik (TA-001/DI-001 reset harian).

---

## 8. Aturan Bisnis (Business Rules)

- BR-01: Kasir hanya bisa membuat order take away, tidak bisa dine-in.
- BR-02: Kitchen mulai masak hanya setelah pembayaran terkonfirmasi (order diproses).
- BR-03: Order cash yang tidak dibayar dalam 15 menit → auto-cancel.
- BR-04: Order dibatalkan hanya bisa saat status "menunggu" (belum dibayar) — oleh owner atau auto-cancel sistem / Midtrans expire.
- BR-05: Cancel = seluruh order (semua item canceled bersamaan). Tidak ada cancel item parsial.
- BR-06: Order "diproses" (sudah bayar) tidak bisa dibatalkan di v1 — handle manual di luar sistem oleh owner.
- BR-07: Order selesai jika semua item berstatus completed atau canceled.
- BR-08: Tambah order di sesi meja sama → order baru (order_id baru).
- BR-09: Kasir update ready → delivered → completed untuk take away saat serahkan pesanan.
- BR-10: Pajak & service charge dihitung di setiap order, disimpan sebagai snapshot.
- BR-11: Konfirmasi pembayaran cash harus idempotent (cegah double).
- BR-12: Perubahan rate pajak/service hanya berlaku untuk order baru.
- BR-13: Customer tanpa login hanya bisa akses order dalam table_session miliknya (via session token yang di-set saat scan QR).
- BR-14: delivered → completed auto setelah 5 menit (configurable) atau override kitchen/kasir.
- BR-15: Nomor order reset harian per (outlet_id, order_type), generate atomik.
- BR-16: Callback Midtrans wajib verifikasi signature_key + idempotent berdasarkan order_id.
- BR-17: ready → delivered fallback auto 10 menit (configurable) + warning 2 menit sebelumnya ke kitchen.
- BR-18: Waiter tidak punya akses sistem; transisi ready→delivered dilakukan kitchen (SOP-WAITER-01).
- BR-19: Status customer "delivered" berarti "dalam pengantaran" (kitchen serah ke waiter), bukan "sampai meja".
- BR-20: Tidak ada refund di v1. Refund item setelah bayar = Fase 2.

---

## 9. Matriks Hak Akses

| Aksi                                    | Customer | Kasir          | Kitchen       | Owner |
| --------------------------------------- | -------- | -------------- | ------------- | ----- |
| Buat order (QR)                         | Ya       | Tidak          | Tidak         | Tidak |
| Buat order (kasir/take away)            | Tidak    | Ya             | Tidak         | Tidak |
| Konfirmasi bayar cash                   | Tidak    | Ya             | Tidak         | Ya    |
| Update item pending→cooking             | Tidak    | Tidak          | Ya            | Ya    |
| Update item cooking→ready               | Tidak    | Tidak          | Ya            | Ya    |
| Update item ready→delivered (dine-in)   | Tidak    | Tidak          | Ya            | Ya    |
| Update item ready→delivered (take away) | Tidak    | Ya             | Ya            | Ya    |
| Update item delivered→completed         | Tidak    | Ya (take away) | Ya (override) | Ya    |
| Batalkan order (hanya "menunggu")       | Tidak    | Tidak          | Tidak         | Ya    |
| Setting pajak/service                   | Tidak    | Tidak          | Tidak         | Ya    |
| Cetak struk thermal                     | Tidak    | Ya             | Tidak         | Ya    |
| Kelola user & role                      | Tidak    | Tidak          | Tidak         | Ya    |

Catatan: Waiter tidak ada kolom — tanpa akses sistem. Tidak ada baris cancel item / refund.

---

## 10. Data Model (Ringkas)

outlet

- id, name, service_rate, tax_rate, cash_timeout_minutes
- delivered_auto_complete_minutes (default 5)
- ready_auto_deliver_minutes (default 10)
- ready_auto_deliver_warning_minutes (default 2)

table

- id, number, qr_token, status

table_session

- id, table_id, started_at, ended_at, status, session_token

order

- id, order_number, outlet_id, table_session_id (nullable)
- order_type (dine_in / take_away)
- customer_name, customer_phone (nullable), status
- subtotal, service_amount, tax_amount, grand_total
- service_rate_snapshot, tax_rate_snapshot
- payment_method, payment_status, payment_ref, paid_at
- cancel_reason, canceled_at, created_by, created_at

order_item

- id, order_id, menu_id, menu_name_snapshot, price_snapshot, qty
- status, updated_by, updated_at, delivered_at, completed_at

payment_log

- id, order_id, method, gateway (midtrans/null), amount, status, gateway_ref, gateway_status, created_at

order_sequence

- id, outlet_id, order_type, date, last_seq (unique: outlet_id + order_type + date)

audit_log

- id, entity, entity_id, action, actor_id, actor_role, timestamp

user

- id, name, role (owner/kasir/kitchen), username, password_hash, active

Catatan: Tidak ada tabel refund. Field canceled_reason hanya diisi saat order dibatalkan (bukan per-item).

---

## 11. Non-Functional Requirements

- Real-time: Update status order/item ke customer, kitchen & dashboard < 2 detik (WebSocket/polling).
- Idempotency: Konfirmasi pembayaran cash & callback Midtrans harus idempotent.
- Keamanan: QR meja pakai token unik (UUID/random 32 char); login dashboard pakai session/JWT; session token customer terikat table_session.
- Audit: Semua perubahan status tercatat di audit_log.
- Ketersediaan: Uptime 99% (jam operasional).
- Responsif: App Menu mobile-first; Dashboard & Kitchen tab untuk tablet/desktop.
- Notifikasi: Layar customer real-time (WA/push Fase 2); warning kitchen untuk auto-deliver.
- Timeout: Auto-cancel, auto-deliver fallback, auto-complete job berjalan tiap menit.
- Payment: Integrasi Midtrans Snap; webhook /payment/midtrans/callback idempotent (verifikasi signature).
- Struk: Printer thermal 58/80mm untuk take away.
- Aplikasi: 3 app — BE Service, Dashboard (web), App Menu (web mobile).

---

## 12. Edge Case

- EC-01: Customer tidak bayar cash → Auto-cancel 15 menit.
- EC-02: Kasir konfirmasi bayar 2x → Idempotency key.
- EC-03: Rate pajak diubah owner → Hanya order baru.
- EC-04: Meja dipakai ulang → Tutup sesi lama, QR valid untuk sesi baru.
- EC-05: Gateway timeout → Status tetap menunggu, retry/cancel.
- EC-06: Customer tambah order → Order baru di sesi yang sama.
- EC-07: Midtrans callback expire → order auto-cancel (sama seperti cash timeout).
- EC-08: Item delivered menggantung → auto-complete 5 menit.
- EC-09: Kitchen lupa tandai completed → auto-complete 5 menit (tidak perlu aksi kitchen).
- EC-10: Dua kitchen tandai delivered bersamaan → idempotent (first wins, second no-op).
- EC-11: Printer thermal offline → tampilkan nomor order di layar, retry cetak manual.
- EC-12: Kitchen lupa tandai delivered → auto-deliver fallback 10 menit + warning 2 menit sebelumnya.
- EC-13: Kitchen override completed lebih awal → delivered→completed manual, auto-complete dibatalkan.
- EC-14: Customer tutup browser setelah scan QR → session token tetap valid, order tetap bisa dilacak via QR ulang (jika sesi masih aktif).
- EC-15: Owner batalkan order "menunggu" → semua item canceled, notifikasi customer.
- EC-16: Customer minta refund setelah bayar → handle manual owner di luar sistem (tidak ada fitur v1).
- EC-17: Customer minta ubah order setelah bayar → handle manual owner (tidak ada edit order v1); alternatif: biarkan selesai, customer order baru.

---

## 13. Metrik Keberhasilan

- Waktu order (scan → bayar): < 3 menit
- Order cash auto-cancel rate: < 10%
- Akurasi perhitungan pajak: 100%
- Sinkronisasi status order: 0 inkonsistensi
- Adopsi self-service QR: > 50% order dine-in
- Waktu ready → delivered (dine-in): < 2 menit
- Auto-deliver fallback rate: < 5% (indikator kitchen disiplin)

---

## 14. Prioritas Development (Roadmap)

MVP (v1):

- BE Service: auth JWT, REST + WebSocket, Midtrans Snap + webhook, job scheduler, printer service, audit log.
- Dashboard: login RBAC (owner/kasir/kitchen).
  - Kasir: order take away, konfirmasi cash, cetak struk, deliver take away.
  - Kitchen: tab Masak + tab Pass/Counter, override completed.
  - Owner: setting outlet, kelola user, audit log, batalkan order (belum bayar).
- App Menu: scan QR, order, bayar cash/non-cash, status real-time, tambah order.
- State machine order/item (termasuk delivered/completed, auto fallback).
- Pajak + service charge.
- Auto-cancel cash + auto-cancel Midtrans expire.
- Auto-deliver fallback 10 menit + warning 2 menit.
- Auto-complete delivered 5 menit.
- Nomor order TA-001/DI-001 reset harian.
- Struk thermal take away.
- Session token customer (tanpa login).
- Cancel order (belum dibayar) oleh owner.
- SOP-WAITER-01 (dokumen terpisah).

Fase 2:

- Notifikasi WA/push ke customer (nomor HP).
- Struk digital.
- Role manager terpisah.
- Refund item setelah bayar (integrasi Midtrans Refund API).
- Cancel item parsial (jika diperlukan).
- Dashboard analytics.

Fase 3:

- Multi-payment gateway.
- Loyalty, promo.
- Multi-outlet.

---

## 15. Pertanyaan Terbuka (Resolved)

| No  | Pertanyaan                  | Keputusan                                                                                        |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Waiter terpisah?            | Tidak. Waiter tanpa aplikasi, SOP manual (SOP-WAITER-01). Transisi ready→delivered oleh Kitchen. |
| 2   | Payment gateway?            | Midtrans (Snap).                                                                                 |
| 3   | Format nomor order?         | TA-001 / DI-001, reset harian per tipe.                                                          |
| 4   | Struk digital v1?           | Tidak, Fase 2. Struk fisik thermal take away masuk v1.                                           |
| 5   | Customer login?             | Tidak perlu, cukup scan QR meja + input nama (wajib) + nomor HP (opsional).                      |
| 6   | Arti delivered?             | "Dalam pengantaran" — kitchen serah ke waiter (bukan sampai meja).                               |
| 7   | Auto-complete?              | Auto 5 menit + override kitchen/kasir.                                                           |
| 8   | Auto-deliver fallback?      | Auto 10 menit + warning 2 menit sebelumnya ke kitchen.                                           |
| 9   | Role Owner/Manager?         | v1 cukup Owner; Manager Fase 2.                                                                  |
| 10  | Kitchen tab?                | 2 tab: "Masak" & "Pass/Counter".                                                                 |
| 11  | SOP Waiter?                 | Dokumen terpisah (SOP-WAITER-01).                                                                |
| 12  | Refund di v1?               | Tidak. Refund item setelah bayar = Fase 2. Handle manual di luar sistem untuk v1.                |
| 13  | Cancel kapan?               | Hanya saat order "menunggu" (belum dibayar). Cancel = seluruh order.                             |
| 14  | Cancel item parsial?        | Tidak ada di v1.                                                                                 |
| 15  | Cancel order setelah bayar? | Tidak ada di v1. Handle manual owner.                                                            |

---

## 16. Lampiran (Referensi)

- Struktur 3 aplikasi (lihat §2).
- State machine order & item (lihat §5).
- Matriks hak akses (lihat §9).
- Data model (lihat §10).
- Edge case (lihat §12).
- SOP-WAITER-01 (dokumen terpisah).

---

Catatan: PRD v1.3 ini siap untuk lanjut ke diagram Mermaid (state machine + sequence diagram), spesifikasi API endpoint, wireframe UI, dan technical design.
