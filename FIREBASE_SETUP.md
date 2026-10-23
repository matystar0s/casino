# Firebase setup

The casino uses Firebase Authentication and Cloud Firestore so accounts and the
leaderboard are shared across browsers. The Firebase web configuration in
`firebase-config.js` identifies the project; it is not an administrator
credential. Never put a Firebase service-account key or a user's password in
this repository.

## Enable Firebase

1. In Firebase Console, open the project configured in `firebase-config.js`.
2. Open **Authentication** and click **Get started** if Firebase prompts you
   to initialize Authentication.
3. In **Authentication → Sign-in method**, open **Email/Password**, enable the
   provider, and save. Enabling only Email link/passwordless sign-in is not
   sufficient; the **Email/Password** provider itself must be enabled.
4. In **Authentication → Settings → Authorized domains**, add the domain where
   the site is hosted. The site must be served over HTTPS or from localhost;
   opening the HTML files directly with `file://` does not support Firebase.
5. Create a **Cloud Firestore** database.
6. Open **Firestore Database → Rules**, replace the rules with `firestore.rules`,
   and publish them.
7. Deploy the static website. Firebase Authentication sends verification links
   to new players before their shared account is created.

If login displays `auth/configuration-not-found`, Authentication has not been
initialized for the Firebase project or its email/password sign-in provider is
not enabled. Confirm the project ID matches `firebase-config.js`, finish
**Authentication → Get started**, then enable and save **Email/Password** in
**Sign-in method**. Wait briefly and refresh the casino before trying again.

## Set up the root account

The sign-in form accepts `root` as a shortcut for the developer email configured
in `firebase-config.js`. This is a public static file, so the developer email
will be visible to site visitors; authentication still requires the Firebase
password. Never put the password in this file or in the repository.
If the password is rejected, select **Zapomenuté heslo – poslat odkaz** in the
sign-in dialog after entering `root`. Firebase can only reset a password for a
root account that already exists in Authentication. Otherwise, register the
developer email first, verify it, and add its UID to the `admins` collection.

1. If the root email does not already exist in Firebase Authentication, register
   through the website with that email, a strong, unique password, and the
   display name `root`. If it already exists, sign in instead.
2. Verify that email using the link Firebase sends, then sign in to the website.
   The signed-in user ID can be found under **Authentication → Users** in
   Firebase Console.
3. In **Firestore Database → Data**, create a document in the `admins`
   collection. Set its document ID to the developer's Authentication user ID
   and add the boolean field `enabled` with value `true`.
4. Sign out and sign in again. The account will now have access to the
   developer page and all registered account records.

   The developer page includes an account overview, account search/status filters,
   sorting, and a CSV export of account names, email addresses, balances, status,
   and registration dates. The quick balance controls apply or remove 100 credits
   or add 1,000 credits; the account's balance and public leaderboard are updated
   together. Feedback can be searched and filtered by type and status.

   If Firebase reports a successful sign-in but the header still shows **Hráčský
účet**, the profile could not be loaded or created in Firestore. Publish
`firestore.rules`, verify the email in Firebase Authentication, and sign out
and back in so the app refreshes the verified-email token. The header now shows
the Firestore error to help identify the missing setup. If the header shows the
player's name but there is no developer link, verify that the `admins` document
ID is exactly that user's Authentication UID and that its `enabled` field is
the boolean `true`, then sign out and in again.

Only the administrator can query the private `accounts` collection. The public
leaderboard contains player display names and credit balances, not email
addresses. Add or remove administrator documents only through Firebase
Console. The rules intentionally deny client writes to the `admins` collection.

## Player feedback

Verified, signed-in player accounts can submit a bug report or improvement
suggestion from the form on the home page. Feedback is stored in the private
`feedback` collection and is readable only by an enabled administrator. Open
**Správa účtů** while signed in as root to review the latest 200 messages and
change each message's status. Publish the current `firestore.rules` for these
permissions and status updates to take effect.

The seven daily rewards are 100, 200, 300, 400, 500, 600, and 1,000 credits.
The first is available as soon as the verified account is created; later
rewards unlock 24 hours after the previous claim. Every reward card displays
its own live countdown, and claimed rewards remain marked as **Vyzvednuto**.
After day seven, a new cycle starts after another 24 hours.

Credits are for demonstration games only; game results and balance changes are
calculated in the browser and are not suitable for real-money use. Existing
accounts saved in a browser's local storage are not automatically transferred
to Firebase; each player must register and verify their email again.
