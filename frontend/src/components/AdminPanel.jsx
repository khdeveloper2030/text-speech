import React, { useState } from "react";
import { Shield, Edit2, Trash2, PlusCircle, Users, X, Save } from "lucide-react";

export default function AdminPanel({ 
  paymentSettings, 
  setPaymentSettings, 
  handleSavePaymentSettings, 
  paymentsList, 
  usersList,
  handleSaveUser,
  handleDeleteUser 
}) {
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
    vipExpiresAt: "2026-11-16" 
  });

  // ចុចបើក Modal សម្រាប់ Insert User ថ្មី
  const handleOpenInsertModal = () => {
    setEditingUser(null);
    setUserForm({
      email: "",
      role: "free",
      dailyLimit: 200,
      dailyUsed: 0,
      lastUsedDate: new Date().toISOString().split('T')[0],
      vipExpiresAt: "2026-11-16"
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
      dailyUsed: user.dailyUsed || 0,
      lastUsedDate: user.lastUsedDate || new Date().toISOString().split('T')[0],
      vipExpiresAt: user.vipExpiresAt || "2026-11-16"
    });
    setShowUserModal(true);
  };

  // Submit Form រក្សាទុកចូល Firebase
  const onUserSubmit = (e) => {
    e.preventDefault();
    handleSaveUser({ ...(editingUser ? { id: editingUser.id } : {}), ...userForm });
    setShowUserModal(false);
  };

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "24px", background: "#ffffff", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
      
      {/* Header & Add Button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #fee2e2", paddingBottom: "12px", marginBottom: "20px" }}>
        <h2 style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "10px", margin: 0, fontSize: "1.35rem" }}>
          <Shield size={26} /> Admin / User Management Dashboard
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
          <PlusCircle size={18} /> Insert New User
        </button>
      </div>

      {/* 📋 តារាងបង្ហាញបញ្ជី Users ទាំងអស់ */}
      <div style={{ marginBottom: "30px" }}>
        <h3 style={{ fontSize: "1rem", color: "#1e293b", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Users size={18} /> All Users Collection (/Users)
        </h3>

        <div style={{ overflowX: "auto", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", color: "#475569" }}>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>Email</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>Role</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>Daily Used / Limit</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>Last Used</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>VIP Expires</th>
                <th style={{ padding: "12px", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                    មិនមានទិន្នន័យអ្នកប្រើប្រាស់ឡើយ
                  </td>
                </tr>
              ) : (
                usersList.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: "500", color: "#0f172a" }}>{u.email}</td>
                    <td style={{ padding: "12px" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "bold",
                        background: u.role === "admin" ? "#fecaca" : (u.role === "vip" ? "#fef3c7" : "#f1f5f9"),
                        color: u.role === "admin" ? "#991b1b" : (u.role === "vip" ? "#92400e" : "#475569")
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#334155" }}>
                      {u.dailyUsed || 0} / {u.dailyLimit === -1 ? "∞ Unlimited" : u.dailyLimit}
                    </td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.lastUsedDate || "N/A"}</td>
                    <td style={{ padding: "12px", color: "#64748b" }}>{u.vipExpiresAt || "N/A"}</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                        {/* ✏️ Icon Edit */}
                        <button 
                          onClick={() => handleOpenEditModal(u)} 
                          title="Edit User"
                          style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Edit2 size={14} /> Edit
                        </button>
                        {/* 🗑️ Icon Delete */}
                        <button 
                          onClick={() => handleDeleteUser(u.id)} 
                          title="Delete User"
                          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
              {editingUser ? "Edit User Record" : "Insert New User Record"}
            </h3>

            <form onSubmit={onUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>User Email:</label>
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
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>Role:</label>
                  <select 
                    value={userForm.role} 
                    onChange={(e) => setUserForm({...userForm, role: e.target.value})} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }}
                  >
                    <option value="free">free</option>
                    <option value="vip">vip</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>Daily Limit (-1 = Unlimited):</label>
                  <input 
                    type="number" 
                    value={userForm.dailyLimit} 
                    onChange={(e) => setUserForm({...userForm, dailyLimit: e.target.value})} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>Daily Used:</label>
                  <input 
                    type="number" 
                    value={userForm.dailyUsed} 
                    onChange={(e) => setUserForm({...userForm, dailyUsed: e.target.value})} 
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", marginTop: "4px", boxSizing: "border-box" }} 
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#475569" }}>VIP Expires At:</label>
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
                  <Save size={16} /> {editingUser ? "Update User" : "Save User to Firebase"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowUserModal(false)}
                  style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "12px 20px", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}