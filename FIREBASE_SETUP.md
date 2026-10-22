# Firebase setup

The casino uses Firebase Authentication and Cloud Firestore so accounts and the
leaderboard are shared across browsers. The Firebase web configuration in
`firebase-config.js` identifies the project; it is not an administrator
credential. Never put a Firebase service-account key or a user's password in
this repository.

## Enable Firebase

1. In Firebase Console, open the project configured in `firebase-config.js`.
2. In **Authentication → Sign-in method**, enable **Email/Password**.
3. In **Authentication → Settings → Authorized domains**, add the domain where
   the site is hosted. The site must be served over HTTPS or from localhost;
   opening the HTML files directly with `file://` does not support Firebase.
4. Create a **Cloud Firestore** database.
5. Open **Firestore Database → Rules**, replace the rules with `firestore.rules`,
   and publish them.
6. Deploy the static website. Firebase Authentication sends verification links
   to new players before their shared account is created.

## Set up the root account

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

Only the administrator can query the private `accounts` collection. The public
leaderboard contains player display names and credit balances, not email
addresses. Add or remove administrator documents only through Firebase
Console. The rules intentionally deny client writes to the `admins` collection.

The seven daily rewards are 100, 200, 300, 400, 500, 600, and 1,000 credits.
The first is available as soon as the verified account is created; later
rewards unlock 24 hours after the previous claim. After day seven, the sequence
starts over after another 24 hours.

Credits are for demonstration games only; game results and balance changes are
calculated in the browser and are not suitable for real-money use. Existing
accounts saved in a browser's local storage are not automatically transferred
to Firebase; each player must register and verify their email again.
