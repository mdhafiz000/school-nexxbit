# Login Branding, Warning Box & Legal Pages Walkthrough

We have successfully refined the sign-up criteria, updated the login page branding, enabled password recovery tools, and integrated a warning alert with the terms and privacy documents.

---

## ⚡ 1. Portal Branding & BETA Warning Banner
* Rebranded the login interface header from `MathQuest` to:
  * **Title**: `school by nexxbit.io`
  * **Subtitle**: `versatile learning portal for kids or students, teachers and parents`
* Integrated a highly visible warning block inside the `.auth-card-compact` container:
  ```
  ⚠️ ATTENTION // USERS BEWARE:
  This is an ongoing BETA release. Data is subject to periodic resets or upgrades as functionality is refined. Do not store sensitive or production-critical credentials.
  ```

---

## 📐 2. Widescreen 2-Column Signup Grid (Scrollbar Removed)
* Refactored [style.css](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/src/style.css) to dynamically adjust the authentication card width.
* On desktop view, showing the Create Account form expands the card width to `760px` and layouts fields in a clean **2-column grid** (e.g., Full Name next to Username, School Prefix next to School Name).
* This makes the container shorter, ensuring it fits cleanly on the screen **without requiring a vertical scrollbar**.
* **Student Gender** select box is now placed directly **next to the Password field** in the right-hand column, keeping rows perfectly balanced.
* **Parent Email (Optional)** input stretches fully across both columns of the authentication card, starting neatly from the left margin.
* The Sign In view remains centered at a compact `400px` width.

---

## 🛡️ 3. Child Safety Updates (School Fields Removed)
* For enhanced security and privacy protection, **School Name and School Prefix fields have been completely removed** from both Student and Teacher signup sections.
* This ensures kids do not disclose local school affiliations on a public-facing registration form.

---

## 🛡️ 4. In-Memory API Rate Limiter
* Coded a custom, high-performance, in-memory rate-limiting middleware in [server.js](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/server.js) with zero external dependency bloat.
* Protects the following critical public endpoints against brute-force attacks:
  * **Registration (`/api/register`)**: Max 5 requests per 15 minutes.
  * **Sign In (`/api/login`)**: Max 10 attempts per 5 minutes.
  * **Forgot Password (`/api/forgot-password`)**: Max 3 attempts per 15 minutes.
* Provides real-time countdown feedback to rate-limited users (e.g., `Too many requests. Please try again in 58 seconds.`).

---

## 📄 5. Terms of Service & Privacy Policy with Back Buttons
* Created two separate monospaced legal pages:
  * [terms.html](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/public/legal/terms.html)
  * [privacy.html](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/public/legal/privacy.html)
* Configured dedicated server-side GET routes in [server.js](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/server.js) (`/legal/terms` and `/legal/privacy`).
* Added a styled **`← BACK TO PORTAL`** button at the top of the body inside both policies.

---

## 🔒 6. Compulsory Emails during Registration
* Modified the registration form in [index.html](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/index.html) and [auth.js](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/src/views/auth.js).
* **Teachers** and **Parents** are now strictly required to enter their own email addresses during signup.
* Added matching backend checks in `/api/register` to verify email inputs and prevent duplicate email registrations.

---

## 🔑 7. Forgot Password Recovery
* Added a **`FORGOT_PASSWORD?`** link below the sign-in form.
* When clicked, admins, teachers, or parents can type their registered email.
* Pings `/api/forgot-password` which validates the email and generates a secure temporary recovery key:
  * `RECOVER_######` (e.g. `RECOVER_812356`)
* The temporary key is updated in the database, allowing immediate password-recovery logins.

---

## 👦 8. Kids Password Management inside Parent Accounts
* Extended the **Connected Kids** panel in [parent.js](file:///e:/Google%20Drive/My%20Drive/1_Coding/school-nexxbit-v1/src/views/parent.js).
* Added a **`Reset PW 🔑`** button next to each linked child account.
* Parents can dynamically override and change their children's passwords by pinging the secure `/api/parent/child/reset-password` endpoint.

---

## 👤 9. Updated Admin Profile & Email/Username Login
* Updated seed defaults and auto-migration scripts to configure the admin account:
  * **Email**: `mohar.studio@gmail.com`
  * **Password**: `#UjangVeelai00#`
* Authentications now support query matches for **either** username or email fields in both PostgreSQL and fallback simulation databases.
