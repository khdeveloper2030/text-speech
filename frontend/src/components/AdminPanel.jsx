import React, { useState } from "react";
import { Shield, Edit2, Trash2, PlusCircle, Users, X, Save, CheckCircle2, RotateCcw, XCircle, Ban, Settings } from "lucide-react";

export default function AdminPanel({ 
  appLang = "km",
  paymentSettings, 
  setPaymentSettings, 
  handleSavePaymentSettings, 
  paymentsList, 
  handleApprovePayment,
  handleSetPaymentStatus,
  handleEditPayment,
  handleDeletePayment,
  usersList,
  handleSaveUser,
  handleDeleteUser 
}) {
  const isKm = appLang !== "en";
  const tr = (km, en) => isKm ? km : en;
  const formatDateDMY = (value) => {
    if (!value) return "—";
    let date;
    if (typeof value?.toDate === "function") date = value.toDate();
    else {
      const raw = String(value).trim();
      const match = raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
      date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(raw);
    }
    if (Number.isNaN(date.getTime())) return String(value);
    return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
  };

  // State សម្រាប់បើក/បិទ Modal Popup
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // State សម្រាប់ទិន្នន័យក្នុង Form
  const [userForm, setUserForm] = useState({ 
    email: "", 
    role: "free", 
    dailyLimit: 200, 
    dailyUsed: 0, 
    lastUsedDate: new Date().toISOString().split('T')[0],
    paymentDate: new Date().toISOString().split("T")[0],
    billingCycle: "monthly",
    vipExpiresAt: "" 
  });

  // ចុចបើក Modal សម្រាប់ Insert User ថ្មី
  const handleOpenInsertModal = () => {
    setEditingUser(null);
    setUserForm({
      email: "",
      role: "free",
      dailyLimit: 200,
      dailyUsed: 0,
      customCharacterLimit: false,
      lastUsedDate: new Date().toISOString().split('T')[0],
      paymentDate: new Date().toISOString().split("T")[0],
      billingCycle: "monthly",
      vipExpiresAt: ""
    });
    setShowUserModal(true);
  };

  // ចុចបើក Modal សម្រាប់ Edit User
  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setUserForm({
      email: user.email || "",
      role: user.role || "free",
      dailyLimit: user.dailyLimit !== undefined ? user.dailyLimit : 200,
      customCharacterLimit: user.customCharacterLimit === true,
      dailyUsed: user.charactersUsed ?? user.dailyUsed ?? 0,
      lastUsedDate: user.lastUsedDate || new Date().toISOString().split('T')[0],
      paymentDate: user.paymentDate || new Date().toISOString().split("T")[0],
      billingCycle: user.billingCycle || "monthly",
      vipExpiresAt: user.vipExpiresAt || ""
    });
    setShowUserModal(true);
  };

  // Calculate expiration automatically from payment date and billing cycle.
  const calculateVipExpiry = (paymentDate, billingCycle) => {
    if (!paymentDate) return "";
    const parts = String(paymentDate).slice(0, 10).split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return "";
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (Number.isNaN(date.getTime())) return "";
    date.setDate(date.getDate() + (billingCycle === "yearly" ? 365 : 30));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // Submit Form រក្សាទុកចូល Firebase
  const onUserSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) {
      const isDuplicate = usersList.some(user => user.email.toLowerCase() === userForm.email.toLowerCase());
      if (isDuplicate) {
        alert(tr("កំហុស៖ អ៊ីមែលនេះមានក្នុងប្រព័ន្ធរួចហើយ! សូមប្រើអ៊ីមែលផ្សេង។", "Error: This email already exists. Please use another email."));
        return;
      }
    }
    const autoExpiry = ["plus", "pro", "vip", "vip unlimited"].includes(String(userForm.role || "").toLowerCase())
      ? calculateVipExpiry(userForm.paymentDate, userForm.billingCycle)
      : (userForm.vipExpiresAt || "");
    handleSaveUser({ ...(editingUser ? { id: editingUser.id } : {}), ...userForm, vipExpiresAt: autoExpiry });
    setShowUserModal(false);
  };

  const [collectionView, setCollectionView] = useState("payments");
  const [settingsFieldView, setSettingsFieldView] = useState("all"); // ⭐️ Option សម្រាប់ជ្រើសរើស Fields ក្នុង Settings
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [paymentPage, setPaymentPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const pageSize = 10;

  const sortedPayments = [...(paymentsList || [])].sort((a, b) => {
    const time = (v) => v?.createdAt?.toMillis ? v.createdAt.toMillis() : (Date.parse(v?.createdAt || "") || 0);
    return time(b) - time(a);
  });
  
  const filteredPayments = sortedPayments.filter((p) => {
    const term = paymentSearch.trim().toLowerCase();
    const matchesText = !term || [p.email, p.userEmail, p.packageName, p.id, p.status, p.uid].some((v) => String(v || "").toLowerCase().includes(term));
    return matchesText && (paymentStatusFilter === "all" || String(p.status || "pending").toLowerCase() === paymentStatusFilter);
  });

  const filteredUsers = (usersList || []).filter((u) => {
    const term = userSearch.trim().toLowerCase();
    const matchesText = !term || [u.email, u.role, u.id, u.uid].some((v) => String(v || "").toLowerCase().includes(term));
    return matchesText && (userRoleFilter === "all" || String(u.role || "free").toLowerCase() === userRoleFilter);
  });

  const paymentPageCount = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const userPageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pagedPayments = filteredPayments.slice((Math.min(paymentPage, paymentPageCount) - 1) * pageSize, Math.min(paymentPage, paymentPageCount) * pageSize);
  const pagedUsers = filteredUsers.slice((Math.min(userPage, userPageCount) - 1) * pageSize, Math.min(userPage, userPageCount) * pageSize);

  const renderPagination = (page, pageCount, setPage) => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "6px", padding: "16px 8px" }}>
      <button type="button" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", background: page <= 1 ? "#f1f5f9" : "#fff", color: "#334155" }}>{tr("ត្រឡប់ក្រោយ", "Back")}</button>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => <button key={n} type="button" onClick={() => setPage(n)} style={{ minWidth: "34px", padding: "7px 10px", borderRadius: "7px", border: "1px solid " + (page === n ? "#2563eb" : "#cbd5e1"), background: page === n ? "#2563eb" : "#fff", color: page === n ? "#fff" : "#334155", fontWeight: page === n ? "bold" : "normal" }}>{n}</button>)}
      <button type="button" disabled={page >= pageCount} onClick={() => setPage(Math.min(pageCount, page + 1))} style={{ padding: "7px 12px", borderRadius: "7px", border: "1px solid #cbd5e1", background: page >= pageCount ? "#f1f5f9" : "#fff", color: "#334155" }}>{tr("បន្ទាប់", "Next")}</button>
      <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "6px" }}>{tr("ទំព័រ", "Page")} {Math.min(page, pageCount)} / {pageCount}</span>
    </div>
  );

  return (
    <div className="admin-panel" style={{ width: "100%", maxWidth: "none", margin: "0 auto", padding: "24px", boxSizing: "border-box", background: "#ffffff", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      
      {/* Header & Add Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #fee2e2", paddingBottom: "12px", marginBottom: "20px" }}>
        <h2 style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.35rem" }}>
          <Shield size={26} /> {tr("ផ្ទាំងគ្រប់គ្រងអ្នកប្រើប្រាស់ និងប្រព័ន្ធ", "User Management & System Dashboard")}
        </h2>
        
        <button 
          onClick={handleOpenInsertModal}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "#16a34a", color: "#ffffff", border: "none",
            padding: "10px 18px", borderRadius: "8px", fontWeight: "bold",
            fontSize: "13px", cursor: "pointer", boxShadow: "0 2px 6px rgba(22, 163, 74, 0.2)"
          }}
        >
          <PlusCircle size={18} /> {tr("បន្ថែមអ្នកប្រើប្រាស់ថ្មី", "Add New User")}
        </button>
      </div>

      {/* Collection Dropdown & Settings Field Filter Dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="admin-collection-view" style={{ fontWeight: "bold", color: "#334155" }}>{tr("ជ្រើសរើសបញ្ជី៖", "Select collection:")}</label>
          <select id="admin-collection-view" value={collectionView} onChange={(e) => setCollectionView(e.target.value)} style={{ minWidth: "220px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
            <option value="payments">{tr("💳 Payments Collection", "💳 Payments Collection")}</option>
            <option value="users">{tr("👥 All Users Collection", "👥 All Users Collection")}</option>
            <option value="settings">{tr("⚙️ Settings Collection (Pricing/QR)", "⚙️ Settings Collection (Pricing/QR)")}</option>
          </select>
        </div>

        {/* ⭐️ Dropdown សម្រាប់ជ្រើសរើស Fields ក្នុង Settings */}
        {collectionView === "settings" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label htmlFor="settings-field-view" style={{ fontWeight: "bold", color: "#2563eb" }}>{tr("ជ្រើសរើស Field៖", "Filter Field:")}</label>
            <select id="settings-field-view" value={settingsFieldView} onChange={(e) => setSettingsFieldView(e.target.value)} style={{ minWidth: "200px", padding: "10px 12px", border: "1px solid #2563eb", borderRadius: "8px", background: "#eff6ff", color: "#1e3a8a", fontWeight: "600" }}>
              <option value="all">{tr("📋 បង្ហាញទាំងអស់ (All Fields)", "📋 Show All Fields")}</option>
              <option value="bank">{tr("🏦 Bank & Account Number", "🏦 Bank & Account Number")}</option>
              <option value="pricing">{tr("💲 Pricing & Limits (VIP/Free)", "💲 Pricing & Limits (VIP/Free)")}</option>
              <option value="contact">{tr("✉️ Contact (Gmail/Telegram)", "✉️ Contact (Gmail/Telegram)")}</option>
              <option value="qr">{tr("🖼️ QR Code URL", "🖼️ QR Code URL")}</option>
            </select>
          </div>
        )}
      </div>

      {/* 💳 Payments Section */}
      <section className="admin-payments-section" style={{ display: collectionView === "payments" ? "block" : "none" }}>
        <div className="admin-payments-heading">
          <div>
            <h3>{tr("💳 បញ្ជីការទូទាត់", "💳 Payments Collection")}</h3>
            <p>{tr("ពិនិត្យសំណើ បង្កាន់ដៃទូទាត់ ហើយអនុម័ត ឬបដិសេធការចូលប្រើ។", "Review payment requests and receipts, then approve or reject access.")}</p>
          </div>
          <span className="admin-payment-count">{filteredPayments.length} {tr("កំណត់ត្រា", "records")}</span>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "14px 0" }}>
          <input value={paymentSearch} onChange={(e) => { setPaymentSearch(e.target.value); setPaymentPage(1); }} placeholder={tr("ស្វែងរក Gmail, Status, Package...", "Search Gmail, status, package...")} aria-label="Search payments" style={{ flex: "1 1 260px", minWidth: "200px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
          <select value={paymentStatusFilter} onChange={(e) => { setPaymentStatusFilter(e.target.value); setPaymentPage(1); }} aria-label="Filter payment status" style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
            <option value="all">{tr("គ្រប់ស្ថានភាព", "All statuses")}</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="unapproved">Unapproved</option>
          </select>
        </div>
        <div className="admin-users-table-wrap" style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("អ៊ីមែល", "Email")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("ស្ថានភាព", "Status")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("កញ្ចប់សេវាកម្ម", "Package")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("ចំនួនទឹកប្រាក់", "Amount")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("លេខសម្គាល់การទូទាត់", "Payment ID")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("ថ្ងៃទូទាត់", "Payment Date")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>{tr("សកម្មភាព", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>{tr("មិនទាន់មានកំណត់ត្រាការទូទាត់ទេ។", "No payment records yet.")}</td></tr>
              ) : (
                pagedPayments.map((payment) => {
                  const status = String(payment.status || "pending").toLowerCase();
                  const createdAt = payment.createdAt?.toDate
                    ? formatDateDMY(payment.createdAt)
                    : payment.createdAt ? formatDateDMY(payment.createdAt) : "—";
                  return (
                    <tr key={payment.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px", fontWeight: "500", color: "#0f172a", overflowWrap: "anywhere" }}>{payment.email || tr("គ្មានអ៊ីមែល", "No email")}</td>
                      <td style={{ padding: "12px" }}>
                        <span className={`payment-status-pill payment-status-${status.replace(/[^a-z]/g, "")}`}>{status === "approved" ? tr("បានអនុម័ត", "Approved") : status === "pending" ? tr("កំពុងរង់ចាំ", "Pending") : status === "unapproved" ? tr("មិនបានអនុម័ត", "Unapproved") : status}</span>
                      </td>
                      <td style={{ padding: "12px", color: "#334155" }}>
                        <div>{payment.packageName || "—"}</div>
                        <small style={{ color: "#64748b" }}>{tr("វដ្តទូទាត់៖", "Billing:")} {payment.billingCycle || "—"}</small>
                        {payment.receiptUrl && <div style={{ marginTop: 7 }}>
                          {(String(payment.receiptContentType || "").startsWith("image/") || String(payment.receiptUrl).match(/\.(png|jpe?g|webp|gif)(\?|$)/i)) && <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer"><img src={payment.receiptUrl} alt={tr("បង្កាន់ដៃទូទាត់", "Payment receipt")} style={{ display: "block", width: 76, height: 76, objectFit: "cover", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 5 }} /></a>}
                          <a className="admin-receipt-link" style={{ display: "inline-flex", marginTop: "5px", marginBottom: 0, padding: "6px 9px", borderRadius: "6px", background: "#eff6ff", color: "#1d4ed8", textDecoration: "none", fontWeight: 700 }} href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">{tr("មើលបង្កាន់ដៃ ↗", "View receipt ↗")}</a>
                        </div>}
                      </td>
                      <td style={{ padding: "12px", color: "#334155" }}>${Number(payment.amount || 0).toFixed(2)} {payment.currency || "USD"}</td>
                      <td style={{ padding: "12px", color: "#64748b", fontSize: "11px", overflowWrap: "anywhere" }}>{payment.id}</td>
                      <td style={{ padding: "12px", color: "#64748b" }}>{createdAt}</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "center", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                          <button type="button" onClick={() => handleApprovePayment(payment)} title={tr("អនុម័ត", "Approve")} style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", padding: "7px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}><CheckCircle2 size={16} /></button>
                          <button type="button" onClick={() => handleSetPaymentStatus(payment, "unapproved")} title={tr("ដកការអនុម័ត", "Unapprove")} style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "7px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}><RotateCcw size={16} /></button>
                          <button type="button" onClick={() => handleEditPayment(payment)} title={tr("កែប្រែការទូទាត់", "Edit payment")} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "7px", borderRadius: "6px", display: "inline-flex", alignItems: "center" }}><Edit2 size={16} /></button>
                          <button type="button" onClick={() => handleDeletePayment && handleDeletePayment(payment)} title={tr("លុបការទូទាត់", "Delete payment")} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "7px", borderRadius: "6px", display: "inline-flex", alignItems: "center" }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(paymentPage, paymentPageCount, setPaymentPage)}
      </section>

      {/* 👥 Users Section */}
      <div style={{ marginBottom: "30px", display: collectionView === "users" ? "block" : "none" }}>
        <h3 style={{ fontSize: "1rem", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} /> {tr("បញ្ជីអ្នកប្រើប្រាស់ទាំងអស់ (/Users)", "All Users Collection (/Users)")}
        </h3>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "14px 0" }}>
          <input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} placeholder={tr("ស្វែងរក Gmail ឬ Role...", "Search Gmail or role...")} style={{ flex: "1 1 260px", minWidth: "200px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
          <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
            <option value="all">{tr("គ្រប់តួនាទី", "All roles")}</option><option value="free">Free</option><option value="plus">Plus</option><option value="pro">Pro</option><option value="vip">VIP</option><option value="vip unlimited">VIP Unlimited</option><option value="admin">Admin</option>
          </select>
        </div>
        <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("អ៊ីមែល", "Email")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("តួនាទី", "Role")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("តួអក្សរបានប្រើ / សរុប", "Characters Used / Total Allowance")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("ប្រើប្រាស់ចុងក្រោយ", "Last Used")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("ផុតកំណត់ VIP", "VIP Expires")}</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>{tr("សកម្មភាព", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>{tr("មិនមានទិន្នន័យអ្នកប្រើប្រាស់ឡើយ", "No users found")}</td></tr>
              ) : (
                pagedUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: "500", color: "#0f172a" }}>{u.email}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold", background: u.role === "admin" ? "#fecaca" : "#f1f5f9", color: u.role === "admin" ? "#991b1b" : "#475569" }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#334155" }}>{u.charactersUsed ?? u.dailyUsed ?? 0} / {u.dailyLimit === -1 ? "∞" : u.dailyLimit}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.lastUsedDate || "N/A"}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.vipExpiresAt || "N/A"}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        <button onClick={() => handleOpenEditModal(u)} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteUser(u.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(userPage, userPageCount, setUserPage)}
      </div>

      {/* ⚙️ Settings Collection Section */}
      <div style={{ marginBottom: "30px", display: collectionView === "settings" ? "block" : "none" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
          <h3 style={{ fontSize: "1.1rem", color: "#1e293b", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Settings size={20} color="#2563eb" /> {tr("ការកំណត់ប្រព័ន្ធ និងព័ត៌មានទូទាត់ (Settings Collection)", "System Settings & Payment Configuration")}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            
            {/* 🏦 Bank & Account Number */}
            {(settingsFieldView === "all" || settingsFieldView === "bank") && (
              <>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ឈ្មោះធនាគារ (bankName):", "Bank Name:")}</label>
                  <input type="text" value={paymentSettings.bankName} onChange={(e) => setPaymentSettings({...paymentSettings, bankName: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("លេខគណនី (accountNumber):", "Account Number:")}</label>
                  <input type="text" value={paymentSettings.accountNumber} onChange={(e) => setPaymentSettings({...paymentSettings, accountNumber: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </>
            )}

            {/* 💲 Pricing & Limits */}
            {(settingsFieldView === "all" || settingsFieldView === "pricing") && (
              <>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("កម្រិត Free (freeLimit):", "Free Limit:")}</label>
                  <input type="number" value={paymentSettings.freeLimit} onChange={(e) => setPaymentSettings({...paymentSettings, freeLimit: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តម្លៃ Plus ($) (vipProPrice):", "Plus Price ($):")}</label>
                  <input type="number" value={paymentSettings.vipProPrice} onChange={(e) => setPaymentSettings({...paymentSettings, vipProPrice: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("កម្រិត Plus Limit (vipProLimit):", "Plus Limit:")}</label>
                  <input type="number" value={paymentSettings.vipProLimit} onChange={(e) => setPaymentSettings({...paymentSettings, vipProLimit: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តម្លៃ VIP ($) (vipUnlimitedPrice):", "VIP Price ($):")}</label>
                  <input type="number" value={paymentSettings.vipUnlimitedPrice} onChange={(e) => setPaymentSettings({...paymentSettings, vipUnlimitedPrice: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("កម្រិត VIP Limit (vipUnlimitedLimit):", "VIP Limit:")}</label>
                  <input type="number" value={paymentSettings.vipUnlimitedLimit} onChange={(e) => setPaymentSettings({...paymentSettings, vipUnlimitedLimit: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ភាគរយបញ្ចុះតម្លៃប្រចាំឆ្នាំ (%) (yearlyDiscountPercent):", "Yearly Discount (%):")}</label>
                  <input type="number" value={paymentSettings.yearlyDiscountPercent} onChange={(e) => setPaymentSettings({...paymentSettings, yearlyDiscountPercent: Number(e.target.value)})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </>
            )}

            {/* ✉️ Contact */}
            {(settingsFieldView === "all" || settingsFieldView === "contact") && (
              <>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("អ៊ីមែលទំនាក់ទំនង (gmail):", "Admin Gmail:")}</label>
                  <input type="email" value={paymentSettings.gmail} onChange={(e) => setPaymentSettings({...paymentSettings, gmail: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តេឡេក្រាម (telegram):", "Telegram Link:")}</label>
                  <input type="text" value={paymentSettings.telegram} onChange={(e) => setPaymentSettings({...paymentSettings, telegram: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </>
            )}

            {/* 🖼️ QR Code URL */}
            {(settingsFieldView === "all" || settingsFieldView === "qr") && (
              <div style={{ background: "#fff", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", gridColumn: "1 / -1" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តំណភ្ជាប់ QR Code (qrCodeUrl):", "QR Code URL:")}</label>
                <input type="text" value={paymentSettings.qrCodeUrl} onChange={(e) => setPaymentSettings({...paymentSettings, qrCodeUrl: e.target.value})} style={{ width: "100%", padding: "8px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
            )}

          </div>

          <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSavePaymentSettings} style={{ background: "#2563eb", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Save size={16} /> {tr("រក្សាទុកការកំណត់ Settings", "Save Settings")}
            </button>
          </div>
        </div>
      </div>

      {/* 🪟 FORM MODAL POPUP */}
      {showUserModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#ffffff", borderRadius: "16px", padding: "24px", maxWidth: "620px", width: "94%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)", position: "relative" }}>
            <button onClick={() => setShowUserModal(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={20} /></button>
            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
              {editingUser ? <Edit2 size={20} color="#2563eb" /> : <PlusCircle size={20} color="#16a34a" />}
              {editingUser ? tr("កែប្រែព័ត៌មានអ្នកប្រើប្រាស់", "Edit User") : tr("បន្ថែមអ្នកប្រើប្រាស់ថ្មី", "Add New User")}
            </h3>
            <form onSubmit={onUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("អ៊ីមែលអ្នកប្រើប្រាស់៖", "User Email:")}</label>
                <input type="email" required value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} placeholder="user@gmail.com" style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តួនាទី៖", "Role:")}</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }}>
                    <option value="free">{tr("ឥតគិតថ្លៃ", "Free")}</option>
                    <option value="plus">Plus</option>
                    <option value="vip">{tr("VIP", "VIP")}</option>
                    <option value="vip unlimited">{tr("VIP Unlimited", "VIP Unlimited")}</option>
                    <option value="admin">{tr("អ្នកគ្រប់គ្រង", "Admin")}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ដែនកំណត់តួអក្សរ៖", "Character Limit:")}</label>
                  <input type="number" value={userForm.dailyLimit} onChange={(e) => setUserForm({...userForm, dailyLimit: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("បានប្រើតួអក្សរ៖", "Characters Used:")}</label>
                  <input type="number" min="0" value={userForm.dailyUsed ?? 0} onChange={(e) => setUserForm({...userForm, dailyUsed: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ថ្ងៃប្រើចុងក្រោយ៖", "Last Used Date:")}</label>
                  <input type="date" value={String(userForm.lastUsedDate || "").slice(0, 10)} onChange={(e) => setUserForm({...userForm, lastUsedDate: e.target.value})} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ថ្ងៃបង់ប្រាក់៖", "Payment Date:")}</label>
                  <input type="date" value={String(userForm.paymentDate || "").slice(0, 10)} onChange={(e) => { const paymentDate = e.target.value; setUserForm((prev) => ({...prev, paymentDate, vipExpiresAt: calculateVipExpiry(paymentDate, prev.billingCycle)})); }} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("រយៈពេលគម្រោង៖", "Billing Cycle:")}</label>
                  <select value={userForm.billingCycle || "monthly"} onChange={(e) => { const billingCycle = e.target.value; setUserForm((prev) => ({...prev, billingCycle, vipExpiresAt: calculateVipExpiry(prev.paymentDate, billingCycle)})); }} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }}>
                    <option value="monthly">{tr("ប្រចាំខែ (+30 ថ្ងៃ)", "Monthly (+30 days)")}</option>
                    <option value="yearly">{tr("ប្រចាំឆ្នាំ (+365 ថ្ងៃ)", "Yearly (+365 days)")}</option>
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ថ្ងៃផុតកំណត់ VIP (គណនាដោយស្វ័យប្រវត្តិ)៖", "VIP Expires (Auto-calculated):")}</label>
                  <input type="date" readOnly value={String(userForm.vipExpiresAt || calculateVipExpiry(userForm.paymentDate, userForm.billingCycle) || "").slice(0, 10)} style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box", background: "#f8fafc" }} />
                  <small style={{ color: "#64748b" }}>{tr("ថ្ងៃផុតកំណត់គណនាពីថ្ងៃបង់ប្រាក់៖ ប្រចាំខែ +30 ថ្ងៃ និងប្រចាំឆ្នាំ +365 ថ្ងៃ។", "Expiry is calculated from payment date: monthly +30 days, yearly +365 days.")}</small>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button type="submit" style={{ flex: 1, background: editingUser ? "#2563eb" : "#16a34a", color: "#ffffff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><Save size={16} /> {editingUser ? tr("ធ្វើបច្ចុប្បន្នភាព", "Update") : tr("រក្សាទុក", "Save")}</button>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>{tr("បោះបង់", "Cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}