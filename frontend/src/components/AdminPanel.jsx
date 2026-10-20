import React, { useState } from "react";
import { Shield, Edit2, Trash2, PlusCircle, Users, X, Save, CheckCircle2, RotateCcw, XCircle, Ban } from "lucide-react";

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
      vipExpiresAt: user.vipExpiresAt || ""
    });
    setShowUserModal(true);
  };

  // Submit Form រក្សាទុកចូល Firebase
  const onUserSubmit = (e) => {
    e.preventDefault();
    // បន្ថែមការឆែក Duplicate Email ពេល Insert ថ្មី
    if (!editingUser) {
      const isDuplicate = usersList.some(user => user.email.toLowerCase() === userForm.email.toLowerCase());
      if (isDuplicate) {
        alert(tr("កំហុស៖ អ៊ីមែលនេះមានក្នុងប្រព័ន្ធរួចហើយ! សូមប្រើអ៊ីមែលផ្សេង។", "Error: This email already exists. Please use another email."));
        return; // បញ្ឈប់ការបញ្ជូនទិន្នន័យ
      }
    }
    handleSaveUser({ ...(editingUser ? { id: editingUser.id } : {}), ...userForm });
    setShowUserModal(false);
  };

  const [collectionView, setCollectionView] = useState("payments");
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
          <Shield size={26} /> {tr("ផ្ទាំងគ្រប់គ្រងអ្នកប្រើប្រាស់", "User Management Dashboard")}
        </h2>
        
        {/* ➕ Icon Button សម្រាប់ Insert User ថ្មី */}
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

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        <label htmlFor="admin-collection-view" style={{ fontWeight: "bold", color: "#334155" }}>{tr("ជ្រើសរើសបញ្ជី៖", "Select collection:")}</label>
        <select id="admin-collection-view" value={collectionView} onChange={(e) => setCollectionView(e.target.value)} style={{ minWidth: "240px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
          <option value="payments">{tr("💳 Payments Collection", "💳 Payments Collection")}</option>
          <option value="users">{tr("👥 All Users Collection", "👥 All Users Collection")}</option>
        </select>
      </div>

      {/* តារាងបញ្ជីការទូទាត់ — ប្រើរចនាប័ទ្មដូចតារាងអ្នកប្រើប្រាស់ */}
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
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>{tr("លេខសម្គាល់ការទូទាត់", "Payment ID")}</th>
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
                    ? payment.createdAt.toDate().toLocaleString(isKm ? "km-KH" : "en-US")
                    : payment.createdAt ? String(payment.createdAt) : "—";
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
                          <button type="button" onClick={() => handleApprovePayment(payment)} title={tr("អនុម័ត", "Approve")} aria-label={tr("អនុម័ត", "Approve")} style={{ background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0", padding: "7px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}><CheckCircle2 size={16} /></button>
                          <button type="button" onClick={() => handleSetPaymentStatus(payment, "unapproved")} title={tr("ដកការអនុម័ត", "Unapprove")} aria-label={tr("ដកការអនុម័ត", "Unapprove")} style={{ background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3", padding: "7px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}><RotateCcw size={16} /></button>
                          <button type="button" onClick={() => handleEditPayment(payment)} title={tr("កែប្រែការទូទាត់", "Edit payment")} aria-label={tr("កែប្រែការទូទាត់", "Edit payment")} style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "7px", borderRadius: "6px", display: "inline-flex", alignItems: "center" }}><Edit2 size={16} /></button>
                          <button type="button" onClick={() => handleDeletePayment && handleDeletePayment(payment)} title={tr("លុបការទូទាត់", "Delete payment")} aria-label={tr("លុបការទូទាត់", "Delete payment")} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "7px", borderRadius: "6px", display: "inline-flex", alignItems: "center" }}><Trash2 size={16} /></button>
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

      {/* 📋 តារាងបង្ហាញបញ្ជី Users ទាំងអស់ */}
      <div style={{ marginBottom: "30px", display: collectionView === "users" ? "block" : "none" }}>
        <h3 style={{ fontSize: "1rem", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} /> {tr("បញ្ជីអ្នកប្រើប្រាស់ទាំងអស់ (/Users)", "All Users Collection (/Users)")}
        </h3>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "14px 0" }}>
          <input value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} placeholder={tr("ស្វែងរក Gmail ឬ Role...", "Search Gmail or role...")} aria-label="Search users" style={{ flex: "1 1 260px", minWidth: "200px", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px" }} />
          <select value={userRoleFilter} onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }} aria-label="Filter user role" style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}>
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
                <tr>
                  <td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                    {tr("មិនមានទិន្នន័យអ្នកប្រើប្រាស់ឡើយ", "No users found")}
                  </td>
                </tr>
              ) : (
                pagedUsers.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: "500", color: "#0f172a" }}>{u.email}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold",
                        background: u.role === "admin" ? "#fecaca" : (String(u.role || "").toLowerCase().includes("vip") || String(u.role || "").toLowerCase() === "unlimited" ? "#fef3c7" : "#f1f5f9"),
                        color: u.role === "admin" ? "#991b1b" : (String(u.role || "").toLowerCase().includes("vip") || String(u.role || "").toLowerCase() === "unlimited" ? "#92400e" : "#475569")
                      }}>
                        {({ admin: tr("អ្នកគ្រប់គ្រង", "Admin"), free: tr("ឥតគិតថ្លៃ", "Free"), plus: "Plus", pro: "Plus", vip: "VIP", "vip unlimited": tr("VIP Unlimited", "VIP Unlimited"), unlimited: tr("គ្មានដែនកំណត់", "Unlimited") })[String(u.role || "").toLowerCase()] || u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#334155" }}>
                      {u.charactersUsed ?? u.dailyUsed ?? 0} / {u.dailyLimit === -1 ? tr("∞ គ្មានដែនកំណត់", "∞ Unlimited") : u.dailyLimit}
                    </td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.lastUsedDate || "N/A"}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.vipExpiresAt || "N/A"}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        {/* ✏️ Icon Edit */}
                        <button 
                          onClick={() => handleOpenEditModal(u)} 
                          title={tr("កែប្រែអ្នកប្រើប្រាស់", "Edit user")}
                          style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* 🗑️ Icon Delete */}
                        <button 
                          onClick={() => handleDeleteUser(u.id)} 
                          title={tr("លុបអ្នកប្រើប្រាស់", "Delete user")}
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Trash2 size={14} />
                        </button>
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

      {/* 🪟 FORM MODAL POPUP (សម្រាប់ Insert & Edit) */}
      {showUserModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "#ffffff", borderRadius: "16px", padding: "24px",
            maxWidth: "500px", width: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            position: "relative"
          }}>
            {/* Modal Close Button */}
            <button 
              onClick={() => setShowUserModal(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={20} />
            </button>

            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
              {editingUser ? <Edit2 size={20} color="#2563eb" /> : <PlusCircle size={20} color="#16a34a" />}
              {editingUser ? tr("កែប្រែព័ត៌មានអ្នកប្រើប្រាស់", "Edit User") : tr("បន្ថែមអ្នកប្រើប្រាស់ថ្មី", "Add New User")}
            </h3>

            <form onSubmit={onUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("អ៊ីមែលអ្នកប្រើប្រាស់៖", "User Email:")}</label>
                <input 
                  type="email" 
                  required 
                  value={userForm.email} 
                  onChange={(e) => setUserForm({...userForm, email: e.target.value})} 
                  placeholder="user@gmail.com"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តួនាទី៖", "Role:")}</label>
                  <select 
                    value={userForm.role} 
                    onChange={(e) => setUserForm({
                      ...userForm,
                      role: e.target.value,
                      dailyLimit: e.target.value === "vip" || e.target.value === "vip unlimited" ? (Number(paymentSettings.vipUnlimitedLimit) || 50000) : e.target.value === "plus" ? (Number(paymentSettings.vipProLimit) || 10000) : e.target.value === "free" ? (Number(paymentSettings.freeLimit) || 200) : -1,
                      customCharacterLimit: false
                    })} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }}
                  >
                    <option value="free">{tr("ឥតគិតថ្លៃ", "Free")}</option>
                    <option value="plus">Plus</option>
                    <option value="vip">{tr("VIP", "VIP")}</option>
                    <option value="vip unlimited">{tr("VIP Unlimited", "VIP Unlimited")}</option>
                    <option value="admin">{tr("អ្នកគ្រប់គ្រង", "Admin")}</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ចំនួនតួអក្សរសរុប (-1 = គ្មានដែនកំណត់)៖", "Total character allowance (-1 = unlimited):")}</label>
                  <input 
                    type="number" 
                    value={userForm.dailyLimit} 
                    onChange={(e) => setUserForm({...userForm, dailyLimit: e.target.value, customCharacterLimit: true})} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("តួអក្សរដែលបានប្រើសរុប៖", "Total characters used:")}</label>
                  <input 
                    type="number" 
                    value={userForm.dailyUsed} 
                    onChange={(e) => setUserForm({...userForm, dailyUsed: e.target.value})} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>{tr("ថ្ងៃផុតកំណត់ VIP៖", "VIP expiration date:")}</label>
                  <input 
                    type="text" 
                    value={userForm.vipExpiresAt} 
                    onChange={(e) => setUserForm({...userForm, vipExpiresAt: e.target.value})} 
                    placeholder="2026-11-16"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button 
                  type="submit" 
                  style={{ flex: 1, background: editingUser ? "#2563eb" : "#16a34a", color: "#ffffff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Save size={16} /> {editingUser ? tr("ធ្វើបច្ចុប្បន្នភាពអ្នកប្រើប្រាស់", "Update User") : tr("រក្សាទុកអ្នកប្រើប្រាស់", "Save User")}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowUserModal(false)}
                  style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                  {tr("បោះបង់", "Cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}