// =============================================
// NARI NIKETAN — Authentication Logic
// =============================================

const Auth = {
  confirmationResult: null,
  recaptchaVerifier: null,

  // ===== EMAIL/PASSWORD =====
  async registerWithEmail(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    try {
      await Store.createUserProfile(cred.user.uid, { name, email, phone: "" });
    } catch (e) {
      console.warn("Could not save initial profile to Firestore:", e);
    }
    return cred.user;
  },

  async loginWithEmail(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  },

  // ===== GOOGLE =====
  async loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await auth.signInWithPopup(provider);
    const user = cred.user;
    // Create profile if new user
    try {
      const existing = await Store.getUserProfile(user.uid);
      if (!existing) {
        await Store.createUserProfile(user.uid, {
          name: user.displayName || "",
          email: user.email || "",
          phone: user.phoneNumber || ""
        });
      }
    } catch (e) {
      console.warn("Could not check/save profile:", e);
    }
    return user;
  },

  // ===== PHONE OTP =====
  initRecaptcha(containerId) {
    if (this.recaptchaVerifier) {
      try { this.recaptchaVerifier.clear(); } catch(e) {}
      this.recaptchaVerifier = null;
    }
    this.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(containerId, {
      size: 'normal',
      callback: () => {
        // reCAPTCHA solved — user can now send OTP
        const btn = document.getElementById('send-otp-btn');
        if (btn) { btn.disabled = false; btn.textContent = 'Send OTP'; }
      },
      'expired-callback': () => {
        App.toast('reCAPTCHA expired. Please verify again.', 'warning');
        const btn = document.getElementById('send-otp-btn');
        if (btn) btn.disabled = true;
      }
    });
    this.recaptchaVerifier.render().then(() => {
      // Disable Send OTP until captcha is solved
      const btn = document.getElementById('send-otp-btn');
      if (btn) { btn.disabled = true; }
    });
  },

  async sendPhoneOTP(phoneNumber) {
    if (!this.recaptchaVerifier) {
      throw new Error('reCAPTCHA not initialised. Please refresh the page.');
    }
    try {
      this.confirmationResult = await auth.signInWithPhoneNumber(phoneNumber, this.recaptchaVerifier);
    } catch (e) {
      // Reset captcha on failure so user can retry
      try { this.recaptchaVerifier.clear(); } catch(err) {}
      this.recaptchaVerifier = null;
      throw e;
    }
    return this.confirmationResult;
  },

  async verifyPhoneOTP(otp) {
    if (!this.confirmationResult) throw new Error("No OTP request found. Please request a new OTP.");
    const cred = await this.confirmationResult.confirm(otp);
    const user = cred.user;
    try {
      const existing = await Store.getUserProfile(user.uid);
      if (!existing) {
        await Store.createUserProfile(user.uid, {
          name: "",
          email: "",
          phone: user.phoneNumber || ""
        });
      }
    } catch (e) {
      console.warn("Profile save error:", e);
    }
    return user;
  },

  // ===== SIGN OUT =====
  async signOut() {
    await auth.signOut();
  },

  // ===== HELPERS =====
  getErrorMessage(err) {
    if (!err) return "An error occurred. Please try again.";
    const code = typeof err === "string" ? err : err.code;
    const msg = typeof err === "object" && err.message ? err.message : "";

    const messages = {
      "auth/operation-not-allowed": "Phone Authentication is not enabled yet in your Firebase Console. Go to Authentication > Sign-in method > Enable Phone.",
      "auth/app-not-authorized": "Domain not authorized. Please run on a local web server (http://localhost) or add your domain in Firebase Console > Authentication > Settings > Authorized domains.",
      "auth/captcha-check-failed": "reCAPTCHA verification failed. Please check the 'I'm not a robot' box and try again.",
      "auth/quota-exceeded": "SMS quota exceeded for today. You can add test phone numbers in Firebase Console > Authentication > Sign-in method > Phone.",
      "auth/invalid-phone-number": "Invalid phone number format. Please check the number and country code.",
      "auth/missing-phone-number": "Please enter a valid 10-digit phone number.",
      "auth/email-already-in-use": "This email is already registered. Please login instead.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/too-many-requests": "Too many attempts. Please try again later in a few minutes.",
      "auth/invalid-verification-code": "Incorrect OTP. Please check the 6 digits and try again.",
      "auth/code-expired": "OTP has expired. Please click Resend to get a new code.",
      "auth/popup-closed-by-user": "Google sign-in was closed before completing. Please try again.",
      "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups for this site.",
      "auth/network-request-failed": "Network error. Please check your internet connection.",
      "auth/account-exists-with-different-credential": "An account with this email already exists with a different sign-in method.",
      "auth/credential-already-in-use": "This phone number is already linked to another account."
    };

    if (code && messages[code]) {
      return messages[code];
    }
    return msg || "An error occurred (" + (code || "unknown") + "). Please try again.";
  }
};
