document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const loginMessageDiv = document.getElementById("login-message");
  const roleContainer = document.getElementById("role-container");
  const roleInfo = document.getElementById("role-info");
  const logoutButton = document.getElementById("logout-button");
  const signupContainer = document.getElementById("signup-container");

  let authToken = localStorage.getItem("activity-app-token");
  let currentRole = localStorage.getItem("activity-app-role");

  function showSection(section, show) {
    section.classList.toggle("hidden", !show);
  }

  function setRoleDashboard(role, email) {
    currentRole = role;
    localStorage.setItem("activity-app-role", role);
    roleInfo.textContent = "";
    roleInfo.textContent = `Logged in as ${email} (${role}).`;
    roleInfo.innerHTML = `Logged in as <strong>${email}</strong> (${role}).`;
    showSection(roleContainer, true);

    if (role === "parent") {
      signupForm.reset();
      showSection(signupContainer, true);
    } else {
      showSection(signupContainer, false);
      const roleMessage = document.createElement("p");
      roleMessage.textContent =
        role === "provider"
          ? "Providers can view activities but only parents can sign up students."
          : "Admins can view activities and manage settings from the API. This prototype currently supports role-based authentication.";
      roleInfo.appendChild(roleMessage);
    }
  }

  function updateAuthHeaders(options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    return { ...options, headers };
  }

  function showMessage(container, text, type) {
    container.textContent = text;
    container.className = `message ${type}`;
    container.classList.remove("hidden");
    setTimeout(() => {
      container.classList.add("hidden");
    }, 5000);
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = "<option value=\"\">-- Select an activity --</option>";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map(
                      (email) =>
                        `<li><span class="participant-email">${email}</span></li>`
                    )
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">${participantsHTML}</div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function fetchCurrentUser() {
    if (!authToken) {
      showSection(roleContainer, false);
      showSection(signupContainer, false);
      return;
    }

    try {
      const response = await fetch("/me", updateAuthHeaders({ method: "GET" }));
      if (!response.ok) {
        throw new Error("Invalid session");
      }
      const user = await response.json();
      authToken = localStorage.getItem("activity-app-token");
      setRoleDashboard(user.role, user.email);
    } catch (error) {
      authToken = null;
      localStorage.removeItem("activity-app-token");
      localStorage.removeItem("activity-app-role");
      showSection(roleContainer, false);
      showSection(signupContainer, false);
      console.warn("Session invalid, logged out.", error);
    }
  }

  async function loginUser(email, password) {
    try {
      const response = await fetch(
        "/login",
        updateAuthHeaders({ method: "POST", body: JSON.stringify({ email, password }) })
      );
      const data = await response.json();
      if (!response.ok) {
        showMessage(loginMessageDiv, data.detail || "Login failed.", "error");
        return;
      }

      authToken = data.token;
      localStorage.setItem("activity-app-token", authToken);
      localStorage.setItem("activity-app-role", data.role);
      setRoleDashboard(data.role, data.email);
      showMessage(loginMessageDiv, "Login successful.", "success");
    } catch (error) {
      showMessage(loginMessageDiv, "Login failed. Please try again.", "error");
      console.error("Login error:", error);
    }
  }

  async function logoutUser() {
    if (!authToken) {
      return;
    }

    try {
      await fetch("/logout", updateAuthHeaders({ method: "POST" }));
    } catch (error) {
      console.warn("Logout request failed", error);
    }

    authToken = null;
    localStorage.removeItem("activity-app-token");
    localStorage.removeItem("activity-app-role");
    showSection(roleContainer, false);
    showSection(signupContainer, false);
    roleInfo.textContent = "";
    showMessage(loginMessageDiv, "Logged out successfully.", "success");
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    await loginUser(email, password);
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        updateAuthHeaders({ method: "POST" })
      );
      const result = await response.json();
      if (response.ok) {
        showMessage(messageDiv, result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    await logoutUser();
  });

  fetchActivities();
  fetchCurrentUser();
});
