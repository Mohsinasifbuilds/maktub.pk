
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const SUPPORT_EMAIL = "Maktubpakistan@gmail.com";
const SUPPORT_PHONE = "03158191125";
const PREMIUM_AMOUNT = 999;
const BANK_IBAN = "PK57MEZN0099100116506954";

const emptyProfile = {
  full_name: "",
  age: "",
  gender: "",
  city: "",
  nationality: "Pakistani",
  education: "",
  occupation: "",
  father_occupation: "",
  father_alive: "yes",
  mother_alive: "yes",
  religion: "",
  maslak: "",
  cast: "",
  income: "",
  brothers: "0",
  sisters: "0",
  about: "",
};

export default function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [phone, setPhone] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) {
      setMessage(
        "Supabase abhi configure nahi hai. Deployment se pehle environment variables add karo."
      );
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message);
      setSession(data?.session ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) {
      setProfile(emptyProfile);
      setProfileLoaded(false);
      return;
    }

    let active = true;

    async function loadProfile() {
      setProfileLoaded(false);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setMessage("Profile load nahi hui: " + error.message);
      } else if (data) {
        setProfile({ ...emptyProfile, ...data });
      }

      setProfileLoaded(true);
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [user]);

  async function handleAuth(event) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Pehle Supabase environment variables configure karo.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (password.length < 8) {
        throw new Error("Password kam az kam 8 characters ka hona chahiye.");
      }

      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) throw error;

        if (data.session) {
          setPage("profile");
          setMessage("Account ban gaya. Apni profile complete karo.");
        } else {
          setMessage(
            "Signup request ho gayi. Email inbox check karo, verification ke baad login karo."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        setPage("home");
        setMessage("Login successful!");
      }
    } catch (error) {
      setMessage(error.message || "Login/signup nahi ho saka.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!supabase) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Pehle apni email enter karo.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      cleanEmail,
      { redirectTo: window.location.origin }
    );
    setLoading(false);

    setMessage(
      error
        ? error.message
        : "Agar account maujood hai, password reset link email par bhej diya gaya hai."
    );
  }

  async function logout() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
    } else {
      setPage("home");
      setMessage("Logout ho gaye.");
    }
  }

  function updateField(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!user || !supabase) {
      setMessage("Profile save karne ke liye login karo.");
      return;
    }

    if (Number(profile.age) < 18) {
      setMessage("MAKTUB par account ke liye age 18+ honi chahiye.");
      return;
    }

    if (profile.about.length > 500) {
      setMessage("About section 500 characters se zyada nahi ho sakta.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            ...profile,
            user_id: user.id,
            age: Number(profile.age),
            brothers: Number(profile.brothers || 0),
            sisters: Number(profile.sisters || 0),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setMessage(
        "Profile details save ho gayi. Approval status database ke rules par depend karta hai."
      );
    } catch (error) {
      setMessage("Profile save nahi hui: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfiles() {
    if (!supabase || !user) {
      setMessage("Profiles dekhne ke liye pehle login karo.");
      setPage("login");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "user_id, full_name, age, gender, city, education, occupation, religion, maslak, cast, about"
      )
      .eq("status", "approved")
      .neq("user_id", user.id)
      .limit(30);

    if (error) {
      setMessage("Profiles load nahi hui: " + error.message);
    } else {
      setProfiles(data ?? []);
      setPage("browse");
      setMessage("");
    }

    setLoading(false);
  }

  async function loadRequests() {
    if (!supabase || !user) {
      setPage("login");
      setMessage("Requests dekhne ke liye login karo.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("rishta_requests")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Requests load nahi hui: " + error.message);
    } else {
      setRequests(data ?? []);
      setPage("requests");
    }

    setLoading(false);
  }

  async function sendRequest(targetId) {
    if (!supabase || !user) {
      setMessage("Rishta request bhejne ke liye login karo.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.rpc("create_rishta_request", {
      target_user_id: targetId,
    });

    setLoading(false);

    if (error) {
      setMessage("Request send nahi hui: " + error.message);
    } else {
      setMessage("Rishta request successfully send ho gayi.");
    }
  }

  async function submitPayment(event) {
    event.preventDefault();

    if (!supabase || !user) {
      setPage("login");
      setMessage("Payment request submit karne ke liye login karo.");
      return;
    }

    if (!phone.trim() || !transactionId.trim()) {
      setMessage("Payment sender phone aur transaction/reference ID required hain.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("premium_payments").insert({
      user_id: user.id,
      sender_phone: phone.trim(),
      transaction_id: transactionId.trim(),
      amount: PREMIUM_AMOUNT,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      setMessage("Payment request submit nahi hui: " + error.message);
    } else {
      setPhone("");
      setTransactionId("");
      setMessage(
        "Payment request submit ho gayi. Admin verification ke baad Premium activate hoga."
      );
    }
  }

  function goTo(nextPage) {
    setMessage("");
    setPage(nextPage);
  }

  const navigation = [
    ["home", "Home"],
    ["profile", "My Profile"],
    ["browse", "Discover"],
    ["requests", "Requests"],
    ["premium", "Premium"],
  ];

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => goTo("home")}>
          <span className="brand-mark">M</span>
          <span>
            <strong>MAKTUB</strong>
            <small>Find Your Naseeb</small>
          </span>
        </button>

        <nav className="main-nav">
          {navigation.map(([key, label]) => (
            <button key={key} onClick={() => {
              if (key === "browse") {
                loadProfiles();
              } else if (key === "requests") {
                loadRequests();
              } else {
                goTo(key);
              }
            }}>
              {label}
            </button>
          ))}
        </nav>

        {user ? (
          <button className="outline-btn" onClick={logout}>
            Logout
          </button>
        ) : (
          <button className="gold-btn" onClick={() => goTo("login")}>
            Join Free
          </button>
        )}
      </header>

      {message && (
        <div className="notice" role="status">
          <span>{message}</span>
          <button
            className="notice-close"
            onClick={() => setMessage("")}
            aria-label="Close message"
          >
            ×
          </button>
        </div>
      )}

      {page === "home" && (
        <main>
          <section className="hero">
            <p className="eyebrow">A NEW BEGINNING STARTS HERE</p>
            <h1>Find Your Naseeb with MAKTUB</h1>
            <p className="hero-copy">
              A simple, respectful way for Pakistani families and individuals
              to explore marriage profiles with privacy in mind.
            </p>
            <div className="hero-actions">
              <button
                className="gold-btn"
                onClick={() => goTo(user ? "profile" : "login")}
              >
                {user ? "Complete Your Profile" : "Create Free Account"}
              </button>
              <button className="outline-btn" onClick={loadProfiles}>
                Discover Profiles
              </button>
            </div>
            <div className="trust-row">
              <span>Privacy focused</span>
              <span>18+ only</span>
              <span>Simple registration</span>
            </div>
          </section>

          <section className="section">
            <p className="eyebrow">HOW IT WORKS</p>
            <h2>Your journey in three steps</h2>
            <div className="feature-grid">
              <article className="feature-card">
                <span className="feature-number">01</span>
                <h3>Create your profile</h3>
                <p>Share your basic, education and family information.</p>
              </article>
              <article className="feature-card">
                <span className="feature-number">02</span>
                <h3>Explore profiles</h3>
                <p>Browse approved profiles and learn about potential matches.</p>
              </article>
              <article className="feature-card">
                <span className="feature-number">03</span>
                <h3>Send a rishta request</h3>
                <p>Express interest and wait for the other person to respond.</p>
              </article>
            </div>
          </section>

          <section className="section safety-section">
            <p className="eyebrow">YOUR PRIVACY MATTERS</p>
            <h2>Take your time. Choose with care.</h2>
            <p>
              Never share passwords or payment credentials. Verify information
              independently and report suspicious behaviour.
            </p>
          </section>
        </main>
      )}

      {page === "login" && (
        <main className="section narrow">
          <p className="eyebrow">WELCOME TO MAKTUB</p>
          <h2>{authMode === "signup" ? "Create your free account" : "Welcome back"}</h2>
          <p>Register or log in with your email address.</p>

          <form className="stack-form" onSubmit={handleAuth}>
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            <button className="gold-btn full" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : authMode === "signup"
                  ? "Create account"
                  : "Login"}
            </button>
          </form>

          <button className="text-btn" onClick={resetPassword} disabled={loading}>
            Forgot password?
          </button>

          <p>
            {authMode === "signup" ? "Already registered?" : "New to MAKTUB?"}{" "}
            <button
              className="text-btn"
              onClick={() =>
                setAuthMode(authMode === "signup" ? "login" : "signup")
              }
            >
              {authMode === "signup" ? "Login here" : "Create account"}
            </button>
          </p>
        </main>
      )}

      {page === "profile" && (
        <main className="section">
          <p className="eyebrow">YOUR PROFILE</p>
          <h2>Create or edit your profile</h2>
          <p>Complete the required details. Do not enter private contact details here.</p>

          {user ? (
            profileLoaded ? (
              <form className="profile-form" onSubmit={saveProfile}>
                <label>
                  Full name *
                  <input name="full_name" value={profile.full_name} onChange={updateField} required maxLength={100} />
                </label>
                <label>
                  Age (18+) *
                  <input name="age" type="number" min="18" max="100" value={profile.age} onChange={updateField} required />
                </label>
                <label>
                  Gender *
                  <select name="gender" value={profile.gender} onChange={updateField} required>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <label>
                  City *
                  <input name="city" value={profile.city} onChange={updateField} required maxLength={100} />
                </label>
                <label>
                  Nationality
                  <input name="nationality" value={profile.nationality} onChange={updateField} />
                </label>
                <label>
                  Education *
                  <input name="education" value={profile.education} onChange={updateField} required />
                </label>
                <label>
                  Occupation *
                  <input name="occupation" value={profile.occupation} onChange={updateField} required />
                </label>
                <label>
                  Father's occupation
                  <input name="father_occupation" value={profile.father_occupation} onChange={updateField} />
                </label>
                <label>
                  Father alive?
                  <select name="father_alive" value={profile.father_alive} onChange={updateField}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Mother alive?
                  <select name="mother_alive" value={profile.mother_alive} onChange={updateField}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Religion
                  <input name="religion" value={profile.religion} onChange={updateField} />
                </label>
                <label>
                  Maslak
                  <input name="maslak" value={profile.maslak} onChange={updateField} />
                </label>
                <label>
                  Cast
                  <input name="cast" value={profile.cast} onChange={updateField} />
                </label>
                <label>
                  Income
                  <input name="income" value={profile.income} onChange={updateField} />
                </label>
                <label>
                  Number of brothers
                  <input name="brothers" type="number" min="0" max="30" value={profile.brothers} onChange={updateField} />
                </label>
                <label>
                  Number of sisters
                  <input name="sisters" type="number" min="0" max="30" value={profile.sisters} onChange={updateField} />
                </label>
                <label className="full-span">
                  About (maximum 500 characters)
                  <textarea name="about" rows="4" maxLength={500} value={profile.about} onChange={updateField} />
                  <small>{profile.about.length}/500</small>
                </label>

                <button className="gold-btn full-span" type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save profile"}
                </button>
              </form>
            ) : (
              <p>Profile load ho rahi hai...</p>
            )
          ) : (
            <button className="gold-btn" onClick={() => goTo("login")}>Login to create your profile</button>
          )}
        </main>
      )}

      {page === "browse" && (
        <main className="section">
          <p className="eyebrow">DISCOVER</p>
          <h2>Approved profiles</h2>
          <p>Sirf approved profiles yahan display hoti hain.</p>

          {!user && <button className="gold-btn" onClick={() => goTo("login")}>Login to browse</button>}

          <div className="profile-grid">
            {profiles.map((item) => (
              <article className="profile-card" key={item.user_id}>
                <div className="profile-avatar">
                  {(item.full_name || "M").slice(0, 1).toUpperCase()}
                </div>
                <h3>{item.full_name}</h3>
                <p>{item.age} years · {item.city}</p>
                <p>{item.education || "Education not provided"}</p>
                <p>{item.occupation || "Occupation not provided"}</p>
                <p>{item.religion || ""} {item.maslak ? `· ${item.maslak}` : ""}</p>
                <p>{item.about || ""}</p>
                <button
                  className="gold-btn full"
                  disabled={loading || !user}
                  onClick={() => sendRequest(item.user_id)}
                >
                  Send Rishta Request
                </button>
              </article>
            ))}
          </div>

          {profiles.length === 0 && (
            <p>No approved profiles available yet, or profiles have not been loaded.</p>
          )}
        </main>
      )}

      {page === "requests" && (
        <main className="section">
          <p className="eyebrow">YOUR CONNECTIONS</p>
          <h2>Rishta requests</h2>
          <p>Sent aur received requests ka status yahan dekho.</p>
          <button className="outline-btn" onClick={loadRequests} disabled={loading}>
            Refresh requests
          </button>
          <div className="request-list">
            {requests.map((request) => (
              <article className="request-card" key={request.id}>
                <p>Request ID: {request.id}</p>
                <p>Status: <strong>{request.status}</strong></p>
                <p>{request.sender_id === user?.id ? "Sent by you" : "Received by you"}</p>
              </article>
            ))}
          </div>
          {requests.length === 0 && <p>No requests to display yet.</p>}
        </main>
      )}

      {page === "premium" && (
        <main className="section narrow">
          <p className="eyebrow">MAKTUB PREMIUM</p>
          <h2>One payment. Lifetime access.</h2>
          <p className="price">Rs. {PREMIUM_AMOUNT.toLocaleString("en-PK")}</p>
          <p>Free account: up to 2 different people ko rishta requests. Premium users ke liye unlimited requests, subject to website rules.</p>

          <div className="bank-details">
            <h3>Bank transfer details</h3>
            <p>IBAN: <strong>{BANK_IBAN}</strong></p>
            <p>Payment karne se pehle bank details independently verify kar lena.</p>
          </div>

          <form className="stack-form" onSubmit={submitPayment}>
            <label>
              Sender phone number
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                placeholder="03XXXXXXXXX"
              />
            </label>
            <label>
              Transaction/reference ID
              <input
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
                required
                maxLength={150}
                placeholder="Enter transaction reference"
              />
            </label>
            <button className="gold-btn full" type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit payment for verification"}
            </button>
          </form>
          <p className="muted">Premium sirf admin ke payment verify karne ke baad activate hoga. Is form se payment automatically verify nahi hoti.</p>
        </main>
      )}

      <footer className="site-footer">
        <div>
          <strong>MAKTUB</strong>
          <p>Find Your Naseeb</p>
        </div>
        <div>
          <p>Support: {SUPPORT_EMAIL}</p>
          <p>Phone: {SUPPORT_PHONE}</p>
        </div>
        <div className="footer-links">
          <button onClick={() => goTo("about")}>About</button>
          <button onClick={() => goTo("privacy")}>Privacy</button>
          <button onClick={() => goTo("terms")}>Terms</button>
        </div>
        <small>© {new Date().getFullYear()} MAKTUB. Please use the platform respectfully.</small>
      </footer>

      {page === "about" && (
        <main className="section narrow">
          <h2>About MAKTUB</h2>
          <p>MAKTUB is a Pakistani matrimonial platform designed to help adults explore potential marriage connections respectfully.</p>
        </main>
      )}

      {page === "privacy" && (
        <main className="section narrow">
          <h2>Privacy</h2>
          <p>Do not share passwords or sensitive financial information. Before launch, publish a complete privacy policy explaining data collection, use, retention and deletion.</p>
        </main>
      )}

      {page === "terms" && (
        <main className="section narrow">
          <h2>Terms and Conditions</h2>
          <p>Users must be 18 or older and provide accurate information. Before public launch, replace this introductory text with complete terms and safety rules.</p>
        </main>
      )}
    </div>
  );
}
