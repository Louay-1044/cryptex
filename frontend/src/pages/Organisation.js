import { useEffect, useState } from "react";
import "../styles/Organisation.css";
import Navbar from "../Components/Navbar";

const API = process.env.REACT_APP_API_URL;

// ---------------- API HELPER ----------------
const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error(
      data?.error ||
        data?.detail ||
        data?.name?.[0] ||
        `HTTP ${res.status}`
    );
    error.status = res.status;
    throw error;
  }

  return data;
};

export default function Organisation() {
  const [organisation, setOrganisation] = useState(null);
  const [invites, setInvites] = useState([]);
  const [traders, setTraders] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [history, setHistory] = useState(null);
  const [orgName, setOrgName] = useState("");
  const [organisationBalance, setOrganisationBalance] = useState(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyTraderName, setHistoryTraderName] = useState("");

  const isInOrganisation = !!organisation;

  const detectOwnership = async (orgId) => {
    try {
      await apiFetch(`${API}/api/organisation/${orgId}/invite/`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setIsOwner(true);
    } catch (e) {
      if (e.status === 400 && e.message === "Username is required.") {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      let org = null;

      try {
        const userDetails = await apiFetch(`${API}/api/account/fetchDetails/`);
        setCurrentUserId(userDetails.id);
      } catch {
        setCurrentUserId(null);
      }

      try {
        org = await apiFetch(`${API}/api/organisation/mine/`);
        setOrganisation(org);
        setRenameValue(org.name);
      } catch (err) {
        if (err.status === 404) {
          setOrganisation(null);
          setRenameValue("");
          setIsOwner(false);
        } else {
          throw err;
        }
      }

      if (org) {
        await detectOwnership(org.id);

        try {
          const [tradersData, portfolioData] = await Promise.all([
          apiFetch(`${API}/api/organisation/${org.id}/traders/`),
          apiFetch(`${API}/api/organisation/${org.id}/portfolio/`),
        ]);

        setTraders(tradersData || []);
        setPortfolio(portfolioData?.portfolio || []);
        setOrganisationBalance(portfolioData?.balance || null);
        } catch (err) {
          setError(err.message || "Failed to load organisation data");
        }
      } else {
        setTraders([]);
        setPortfolio([]);
        setHistory(null);
        setOrganisationBalance(null);
        setHistoryTraderName("");
      }

      try {
        const invitesData = await apiFetch(
          `${API}/api/organisation/invitations/`
        );
        setInvites(invitesData || []);
      } catch {
        setInvites([]);
      }
    } catch (e) {
      setError(e.message || "Failed to load organisation data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createOrganisation = async () => {
    try {
      setError(null);

      if (!orgName.trim()) {
        setError("Organisation name is required.");
        return;
      }

      await apiFetch(`${API}/api/organisation/create/`, {
        method: "POST",
        body: JSON.stringify({ name: orgName.trim() }),
      });

      setOrgName("");
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const renameOrganisation = async () => {
    try {
      setError(null);

      if (!renameValue.trim()) {
        setError("Organisation name is required.");
        return;
      }

      const data = await apiFetch(
        `${API}/api/organisation/${organisation.id}/rename/`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: renameValue.trim() }),
        }
      );

      setOrganisation(data);
      setRenameValue(data.name);
      setIsOwner(true);
    } catch (e) {
      if (e.status === 403) {
        setIsOwner(false);
      }
      setError(e.message);
    }
  };

  const deleteOrganisation = async () => {
    if (!window.confirm("Delete organisation?")) return;

    try {
      setError(null);

      await apiFetch(
        `${API}/api/organisation/${organisation.id}/delete/`,
        {
          method: "DELETE",
        }
      );

      setOrganisation(null);
      setTraders([]);
      setPortfolio([]);
      setHistory(null);
      setHistoryTraderName("");
      setRenameValue("");
      setIsOwner(false);

      await loadData();
    } catch (e) {
      if (e.status === 403) {
        setIsOwner(false);
      }
      setError(e.message);
    }
  };

  const inviteTrader = async () => {
    try {
      setError(null);

      if (!inviteUsername.trim()) {
        setError("Username is required.");
        return;
      }

      await apiFetch(
        `${API}/api/organisation/${organisation.id}/invite/`,
        {
          method: "POST",
          body: JSON.stringify({ username: inviteUsername.trim() }),
        }
      );

      setInviteUsername("");
    } catch (e) {
      if (e.status === 403 || e.status === 404) {
        setIsOwner(false);
      }
      setError(e.message);
    }
  };

  const acceptInvite = async (orgId) => {
    try {
      setError(null);

      await apiFetch(
        `${API}/api/organisation/${orgId}/invitation/accept/`,
        {
          method: "POST",
        }
      );

      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeTrader = async (userId) => {
    if (!window.confirm("Remove this trader from the organisation?")) return;

    try {
      setError(null);

      await apiFetch(
        `${API}/api/organisation/${organisation.id}/remove/${userId}/`,
        {
          method: "DELETE",
        }
      );

      setTraders((prev) => prev.filter((t) => t.user !== userId));

      if (history && historyTraderName) {
        setHistory(null);
        setHistoryTraderName("");
      }
    } catch (e) {
      if (e.status === 403) {
        setIsOwner(false);
      }
      setError(e.message);
    }
  };

  const leaveOrganisation = async () => {
  if (!organisation || !currentUserId) return;

  if (!window.confirm("Leave this organisation?")) return;

  try {
    setError(null);

    await apiFetch(
      `${API}/api/organisation/${organisation.id}/remove/${currentUserId}/`,
      {
        method: "DELETE",
      }
    );

    setOrganisation(null);
    setTraders([]);
    setPortfolio([]);
    setHistory(null);
    setHistoryTraderName("");
    setRenameValue("");
    setIsOwner(false);

    await loadData();
  } catch (e) {
    setError(e.message);
  }
};

  const viewHistory = async (userId, username) => {
    try {
      setError(null);

      const data = await apiFetch(
        `${API}/api/organisation/${organisation.id}/trader/${userId}/history/`
      );

      setHistory(data.trade_history || []);
      setHistoryTraderName(username || "");
    } catch (e) {
      if (e.status === 403) {
        setIsOwner(false);
      }
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="organisation-page">
        <Navbar />
        <div className="organisation-container">
          <div className="organisation-loading-card">
            <p>Loading organisation workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="organisation-page">
      <Navbar />

      <div className="organisation-container">
        <div className="organisation-header">
          <h1>Organisation</h1>
          <p>Create, manage, or join an organisation</p>
        </div>

        {error && <p className="organisation-error">{error}</p>}

        {!isInOrganisation && invites.length > 0 && (
          <section className="organisation-section">
            <h2>Pending Invitations</h2>

            <div className="organisation-card-grid">
              {invites.map((inv) => (
                <div key={inv.id} className="organisation-card">
                  <div className="organisation-card-top">
                    <div>
                      <h3>{inv.organisation_name}</h3>
                      <p>Invitation waiting for your response</p>
                    </div>
                  </div>

                  <div className="organisation-stat-row">
                    <div className="organisation-stat-box">
                      <h4>Status</h4>
                      <p>Pending</p>
                    </div>
                    <div className="organisation-stat-box">
                      <h4>Received</h4>
                      <p>{new Date(inv.joined_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <button
                    className="organisation-btn organisation-btn-success"
                    onClick={() => acceptInvite(inv.organisation)}
                  >
                    Accept Invitation
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isInOrganisation && (
          <section className="organisation-section organisation-create-card">
            <h2>Create Your Organisation</h2>
            <p>
              Create a new organisation to manage traders, monitor shared
              portfolio activity, and invite other users.
            </p>

            <div className="organisation-form-row">
              <input
                className="organisation-input"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Organisation name"
              />
              <button
                className="organisation-btn"
                onClick={createOrganisation}
              >
                Create Organisation
              </button>
            </div>
          </section>
        )}

        {isInOrganisation && (
          <>
            <section className="organisation-hero-card">
              <div className="organisation-hero-left">
                <h2>{organisation.name}</h2>
                <p>
                  {isOwner
                    ? "You are the owner of this organisation."
                    : "You are a trader in this organisation."}
                </p>
              </div>

              <div className="organisation-hero-actions">
                {isOwner ? (
                  <button
                    className="organisation-btn organisation-btn-danger"
                    onClick={deleteOrganisation}
                  >
                    Delete Organisation
                  </button>
                ) : (
                  <button
                    className="organisation-btn organisation-btn-danger"
                    onClick={leaveOrganisation}
                  >
                    Leave Organisation
                  </button>
                )}
              </div>
            </section>

            {isOwner && (
              <section className="organisation-section">

                <div className="organisation-control-grid">
                  <div className="organisation-card">
                    <h3>Rename Organisation</h3>
                    <p>Update the public name of your organisation.</p>
                    <div className="organisation-form-column">
                      <input
                        className="organisation-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="New organisation name"
                      />
                      <button
                        className="organisation-btn"
                        onClick={renameOrganisation}
                      >
                        Save Name
                      </button>
                    </div>
                  </div>

                  <div className="organisation-card">
                    <h3>Invite Trader</h3>
                    <p>Send an invitation to another user by username.</p>
                    <div className="organisation-form-column">
                      <input
                        className="organisation-input"
                        placeholder="Trader username"
                        value={inviteUsername}
                        onChange={(e) => setInviteUsername(e.target.value)}
                      />
                      <button
                        className="organisation-btn"
                        onClick={inviteTrader}
                      >
                        Send Invite
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="organisation-section">
            <h2>Portfolio Overview</h2>

            <div className="organisation-card">
              <div className="organisation-card-top">
                <div>
                  <h3>Organisation Wallet</h3>
                  <p>Shared wallet used by the organisation</p>
                </div>
                <h4 className="organisation-highlight-value">
                  ${organisationBalance ?? "0.00"}
                </h4>
              </div>

              {portfolio.length === 0 ? (
                <p className="organisation-empty-text">No crypto holdings</p>
              ) : (
                <div className="organisation-holdings-list">
                  {portfolio.map((holding, index) => (
                    <div key={index} className="organisation-holding-item">
                      <span>{holding.ticker_id}</span>
                      <strong>{holding.amount}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

            <section className="organisation-section">
              <h2>Organisation Traders</h2>

              {traders.length === 0 ? (
                <p className="organisation-empty-text">No traders found.</p>
              ) : (
                <div className="organisation-trader-list">
                  {traders.map((t) => (
                    <div key={t.id} className="organisation-trader-card">
                      <div className="organisation-trader-main">
                        <div>
                          <h3>{t.username}</h3>
                          <p>{t.email}</p>
                        </div>

                        {Number(t.user) === Number(organisation.owner) && (
                          <span className="organisation-badge">
                            Owner
                          </span>
                        )}
                      </div>

                      {isOwner &&
                        Number(t.user) !== Number(organisation.owner) && (
                          <div className="organisation-trader-actions">
                            <button
                              className="organisation-btn"
                              onClick={() => viewHistory(t.user, t.username)}
                            >
                              View History
                            </button>

                            <button
                              className="organisation-btn organisation-btn-danger"
                              onClick={() => removeTrader(t.user)}
                            >
                              Remove Trader
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {isOwner && history && (
              <section className="organisation-section">
                <div className="organisation-history-header">
                  <div>
                    <h2>Trade History</h2>
                    <p>
                      {historyTraderName
                        ? `Showing trade history for ${historyTraderName}`
                        : "Trader history"}
                    </p>
                  </div>

                  <button
                    className="organisation-btn"
                    onClick={() => {
                      setHistory(null);
                      setHistoryTraderName("");
                    }}
                  >
                    Close
                  </button>
                </div>

                {history.length === 0 ? (
                  <p className="organisation-empty-text">No trades found.</p>
                ) : (
                  <div className="organisation-history-list">
                    {history.map((h, i) => (
                      <div key={i} className="organisation-history-card">
                        <div className="organisation-history-top">
                          <span
                            className={`organisation-history-tag ${
                              h.type === "buy"
                                ? "organisation-history-buy"
                                : "organisation-history-sell"
                            }`}
                          >
                            {h.type?.toUpperCase()}
                          </span>
                          <strong>{h.currency}</strong>
                        </div>

                        <div className="organisation-stat-row">
                          <div className="organisation-stat-box">
                            <h4>Amount</h4>
                            <p>{h.amount}</p>
                          </div>
                          <div className="organisation-stat-box">
                            <h4>Price</h4>
                            <p>${h.price}</p>
                          </div>
                          <div className="organisation-stat-box">
                            <h4>Date</h4>
                            <p>{new Date(h.datetime).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}