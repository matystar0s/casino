(function () {
    const STARTING_BALANCE = 1000;
    const REWARD_INTERVAL = 24 * 60 * 60 * 1000;
    const REWARDS = [100, 200, 300, 400, 500, 600, 1000];
    const accountPanel = document.getElementById('casinoAccount');
    const rewardPanel = document.getElementById('dailyRewards');
    let firebase;
    let auth;
    let database;
    let currentUser = null;
    let currentAccount = null;
    let developer = false;
    let registrationInProgress = false;
    let accountLoadError = '';
    let accounts = [];
    let feedback = [];
    let unsubscribeAccount;
    let unsubscribeAdminAccounts;
    let unsubscribeFeedback;
    let rewardTimer;
    let dialog;
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });
    ready.catch(() => {});

    function notify(message) {
        const toast = document.getElementById('casinoToast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('visible');
        window.clearTimeout(notify.timer);
        notify.timer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
    }

    function reportError(context, error) {
        console.error(context, error);
        notify(error.message || 'Operaci se nepodařilo dokončit. Zkuste to znovu.');
    }

    async function waitUntilReady() {
        try {
            await ready;
            return true;
        } catch (error) {
            notify('Připojení k Firebase není dostupné. Zkontrolujte konfiguraci a připojení.');
            return false;
        }
    }

    function getAccount() {
        return currentAccount;
    }

    function isDeveloper() {
        return developer;
    }

    function updatePanel() {
        if (!accountPanel) return;
        accountPanel.replaceChildren();
        const summary = document.createElement('div');
        summary.className = 'account-summary';
        const name = document.createElement('strong');
        name.textContent = currentAccount ? (developer ? 'root' : currentAccount.name) : 'Hráčský účet';
        const balance = document.createElement('span');
        balance.textContent = currentAccount
            ? `${currentAccount.balance.toLocaleString('cs-CZ')} kreditů`
            : accountLoadError
                ? accountLoadError
                : currentUser
                    ? 'Přihlášení proběhlo, načítá se herní účet…'
                    : 'Přihlaste se nebo si vytvořte účet';
        summary.append(name, balance);

        const actions = document.createElement('div');
        actions.className = 'account-actions';
        if (!currentUser) {
            const accountButton = document.createElement('button');
            accountButton.type = 'button';
            accountButton.textContent = 'Přihlásit / vytvořit účet';
            accountButton.addEventListener('click', openDialog);
            actions.append(accountButton);
        } else {
            if (developer) {
                const developerLink = document.createElement('a');
                developerLink.className = 'button-link';
                developerLink.href = 'developer.html';
                developerLink.textContent = 'Správa účtů';
                actions.append(developerLink);
            }
            const logoutButton = document.createElement('button');
            logoutButton.type = 'button';
            logoutButton.className = 'button-quiet';
            logoutButton.textContent = 'Odhlásit';
            logoutButton.addEventListener('click', async () => {
                try {
                    await ready;
                    await firebase.signOut(auth);
                } catch (error) {
                    reportError('Nepodařilo se odhlásit.', error);
                }
            });
            actions.append(logoutButton);
        }
        accountPanel.append(summary, actions);
    }

    function renderLeaderboard(entries) {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) return;
        leaderboard.replaceChildren();
        if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            empty.textContent = 'Zatím tu nejsou žádní hráči. Zaregistrujte se a buďte první!';
            leaderboard.append(empty);
            return;
        }
        const list = document.createElement('ol');
        list.className = 'leaderboard-list';
        entries.forEach((entry) => {
            const item = document.createElement('li');
            const playerName = document.createElement('strong');
            playerName.textContent = entry.name;
            const playerBalance = document.createElement('span');
            playerBalance.textContent = `${entry.balance.toLocaleString('cs-CZ')} kreditů`;
            item.append(playerName, playerBalance);
            list.append(item);
        });
        leaderboard.append(list);
    }

    function formatCountdown(milliseconds) {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    }

    function renderRewards() {
        if (!rewardPanel) return;
        rewardPanel.replaceChildren();
        window.clearInterval(rewardTimer);
        const cards = document.createElement('div');
        cards.className = 'reward-list';

        if (!currentAccount) {
            const message = document.createElement('p');
            message.className = 'dialog-note';
            message.textContent = 'Pro vyzvednutí denních odměn se přihlaste ke svému účtu.';
            rewardPanel.append(message);
            return;
        }

        const currentIndex = Number.isInteger(currentAccount.rewardIndex)
            ? currentAccount.rewardIndex
            : 0;
        const lastRewardAt = currentAccount.lastRewardAt;
        const lastRewardTime = lastRewardAt && typeof lastRewardAt.toMillis === 'function'
            ? lastRewardAt.toMillis()
            : null;
        const now = Date.now();
        let hasCountdown = false;

        REWARDS.forEach((amount, index) => {
            const card = document.createElement('article');
            card.className = 'reward-card';
            const title = document.createElement('strong');
            title.textContent = `Den ${index + 1}`;
            const value = document.createElement('span');
            value.className = 'reward-value';
            value.textContent = `+${amount} kreditů`;
            const details = document.createElement('span');
            details.className = 'reward-status';
            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.textContent = 'Zamčeno';
            const completedCycle = currentIndex >= REWARDS.length;
            const nextCycleDayOne = completedCycle && index === 0;
            const alreadyClaimed = completedCycle || index < currentIndex;
            const unlockTime = lastRewardTime === null
                ? now
                : lastRewardTime + REWARD_INTERVAL * (completedCycle
                    ? index + 1
                    : alreadyClaimed ? 1 : index - currentIndex + 1);
            const canClaim = (index === currentIndex || nextCycleDayOne) &&
                now >= unlockTime;

            if (alreadyClaimed) {
                details.textContent = 'Vyzvednuto';
                button.textContent = 'Vyzvednuto';
            }

            if (canClaim) {
                details.textContent = nextCycleDayOne ? 'Nový týden je otevřen' : 'Odměna je připravena';
                button.disabled = developer;
                button.textContent = 'Vyzvednout';
                button.addEventListener('click', claimReward);
            } else if (unlockTime > now) {
                const countdown = document.createElement('span');
                countdown.className = 'reward-countdown';
                countdown.textContent = formatCountdown(unlockTime - now);
                details.append(document.createElement('br'), countdown);
                if (!alreadyClaimed) button.textContent = 'Čeká se';
                hasCountdown = true;
            } else if (!alreadyClaimed) {
                details.textContent = index === 0 ? 'Otevřeno ihned' : 'Odměna se odemkne po předchozí';
            }
            card.append(title, value, details, button);
            cards.append(card);
        });
        rewardPanel.append(cards);

        if (hasCountdown) {
            rewardTimer = window.setInterval(renderRewards, 1000);
        }
    }

    function renderManagedAccounts() {
        document.dispatchEvent(new CustomEvent('casino:accounts-changed'));
    }

    function renderManagedFeedback() {
        document.dispatchEvent(new CustomEvent('casino:feedback-changed'));
    }

    function openDialog() {
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.className = 'account-dialog';
            dialog.innerHTML = `
                <form class="account-form">
                    <button class="dialog-close" type="button" aria-label="Zavřít">×</button>
                    <p class="eyebrow">Online kasino</p>
                    <h2>Hráčský účet</h2>
                    <p class="dialog-note">Registrace a přihlášení používají Firebase. Pro vytvoření účtu zadejte e-mail, herní jméno a heslo. E-mail je potřeba ověřit.</p>
                    <label for="accountEmail">E-mail</label>
                    <input id="accountEmail" name="email" type="text" maxlength="254" autocomplete="username" required>
                    <label for="accountName">Herní jméno (při registraci)</label>
                    <input id="accountName" name="name" type="text" maxlength="24" autocomplete="nickname">
                    <label for="accountPassword">Heslo</label>
                    <input id="accountPassword" name="password" type="password" minlength="6" autocomplete="current-password" required>
                    <p class="account-dialog-message" aria-live="polite"></p>
                    <div class="dialog-actions">
                        <button type="submit" name="action" value="login" class="button-secondary">Přihlásit se</button>
                        <button type="submit" name="action" value="create">Vytvořit účet (+1000 kreditů)</button>
                    </div>
                    <button class="button-quiet" type="button" data-action="reset-password">Zapomenuté heslo – poslat odkaz</button>
                    <p class="dialog-note">Při prvním přihlášení ověřeným e-mailem se vytvoří sdílený účet s 1000 testovacími kredity.</p>
                </form>`;
            document.body.append(dialog);
            dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) dialog.close();
            });
            dialog.querySelector('[data-action="reset-password"]').addEventListener('click', async (event) => {
                const resetButton = event.currentTarget;
                const message = dialog.querySelector('.account-dialog-message');
                const loginName = dialog.querySelector('#accountEmail').value.trim();
                const email = loginName.toLocaleLowerCase('en-US') === 'root'
                    ? window.CASINO_FIREBASE_CONFIG.developerEmail
                    : loginName;
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    message.textContent = 'Zadejte platný e-mail nebo jméno root.';
                    return;
                }
                resetButton.disabled = true;
                try {
                    await ready;
                    await firebase.sendPasswordResetEmail(auth, email);
                    message.textContent = 'Pokud účet existuje, Firebase poslal na jeho e-mail odkaz k obnovení hesla.';
                } catch (error) {
                    console.error('Nepodařilo se poslat odkaz k obnovení hesla.', error);
                    message.textContent = firebaseErrorMessage(error);
                } finally {
                    resetButton.disabled = false;
                }
            });
            dialog.querySelector('form').addEventListener('submit', async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const message = dialog.querySelector('.account-dialog-message');
                const submitButtons = Array.from(form.querySelectorAll('button[type="submit"]'));
                const loginName = form.elements.email.value.trim();
                const name = form.elements.name.value.trim();
                const password = form.elements.password.value;
                const action = event.submitter ? event.submitter.value : 'login';
                const email = action === 'login' && loginName.toLocaleLowerCase('en-US') === 'root'
                    ? window.CASINO_FIREBASE_CONFIG.developerEmail
                    : loginName;
                submitButtons.forEach((button) => { button.disabled = true; });
                try {
                    await ready;
                    if (action === 'create') {
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                            message.textContent = 'Zadejte platnou e-mailovou adresu.';
                            return;
                        }
                        if (!name || name.length > 24) {
                            message.textContent = 'Zadejte herní jméno o maximálně 24 znacích.';
                            return;
                        }
                        registrationInProgress = true;
                        try {
                            const credential = await firebase.createUserWithEmailAndPassword(auth, email, password);
                            await firebase.updateProfile(credential.user, { displayName: name });
                            await firebase.sendEmailVerification(credential.user);
                            await firebase.signOut(auth);
                            message.textContent = 'Poslali jsme vám ověřovací e-mail. Po ověření se přihlaste.';
                        } finally {
                            registrationInProgress = false;
                        }
                    } else {
                        const credential = await firebase.signInWithEmailAndPassword(auth, email, password);
                        await firebase.reload(credential.user);
                        if (!credential.user.emailVerified) {
                            await firebase.sendEmailVerification(credential.user);
                            await firebase.signOut(auth);
                            message.textContent = 'Nejdříve ověřte e-mail. Poslali jsme vám nový ověřovací odkaz.';
                            return;
                        }
                        dialog.close();
                        notify('Přihlášení proběhlo.');
                    }
                } catch (error) {
                    console.error('Nepodařilo se přihlásit nebo vytvořit účet.', error);
                    message.textContent = firebaseErrorMessage(error);
                } finally {
                    submitButtons.forEach((button) => { button.disabled = false; });
                }
            });
        }
        dialog.querySelector('#accountEmail').value = currentUser ? currentUser.email : '';
        dialog.querySelector('#accountName').value = '';
        dialog.querySelector('#accountPassword').value = '';
        dialog.querySelector('.account-dialog-message').textContent = '';
        dialog.showModal();
    }

    function firebaseErrorMessage(error) {
        const messages = {
            'auth/email-already-in-use': 'Tento e-mail už účet má. Přihlaste se.',
            'auth/invalid-credential': 'E-mail root nebo heslo nesouhlasí. Zkontrolujte, že tento účet existuje ve Firebase Authentication a používáte jeho aktuální heslo.',
            'auth/invalid-email': 'Zadejte platnou e-mailovou adresu.',
            'auth/user-not-found': 'Účet v Firebase Authentication neexistuje. Nejdříve jej vytvořte.',
            'auth/weak-password': 'Heslo musí mít alespoň 6 znaků.',
            'auth/too-many-requests': 'Příliš mnoho pokusů. Zkuste to později.',
            'auth/operation-not-allowed': 'Ve Firebase Console zapněte přihlášení e-mailem a heslem.',
            'auth/configuration-not-found': 'Firebase Authentication ještě není v projektu nastavené. Ve Firebase Console otevřete Authentication, klikněte na Get started a v Sign-in method zapněte Email/Password.',
            'auth/network-request-failed': 'Firebase se nepodařilo kontaktovat. Zkontrolujte připojení k internetu.',
            'permission-denied': 'Firebase odmítl přístup. Ve Firestore publikujte aktuální firestore.rules a ověřte, že jste přihlášení ověřeným hráčským účtem.',
            'firestore/permission-denied': 'Firebase odmítl přístup. Ve Firestore publikujte aktuální firestore.rules a ověřte, že jste přihlášení ověřeným hráčským účtem.',
            'failed-precondition': 'Firestore není dokončené nastavení. Zkontrolujte vytvoření databáze a publikování pravidel.',
            'firestore/failed-precondition': 'Firestore není dokončené nastavení. Zkontrolujte vytvoření databáze a publikování pravidel.',
            'unavailable': 'Firestore není momentálně dostupné. Zkuste to znovu za chvíli.',
            'firestore/unavailable': 'Firestore není momentálně dostupné. Zkuste to znovu za chvíli.'
        };
        return messages[error.code] || error.message || 'Operaci se nepodařilo dokončit.';
    }

    async function ensureAccount(user) {
        const accountRef = firebase.doc(database, 'accounts', user.uid);
        let snapshot = await firebase.getDoc(accountRef);
        if (!snapshot.exists()) {
            const name = (user.displayName || user.email.split('@')[0]).trim().slice(0, 24) || 'Hráč';
            const account = {
                email: user.email,
                name,
                balance: STARTING_BALANCE,
                rewardIndex: 0,
                lastRewardAt: null,
                disabled: false,
                createdAt: firebase.serverTimestamp()
            };
            const batch = firebase.writeBatch(database);
            batch.set(accountRef, account);
            batch.set(firebase.doc(database, 'leaderboard', user.uid), {
                name,
                balance: STARTING_BALANCE
            });
            await batch.commit();
            snapshot = await firebase.getDoc(accountRef);
        }
        return snapshot.data();
    }

    function listenToLeaderboard() {
        const board = firebase.collection(database, 'leaderboard');
        const topPlayers = firebase.query(board, firebase.orderBy('balance', 'desc'), firebase.limit(10));
        firebase.onSnapshot(topPlayers, (snapshot) => {
            renderLeaderboard(snapshot.docs.map((item) => item.data()));
        }, (error) => reportError('Nepodařilo se načíst společný žebříček.', error));
    }

    function stopAccountListeners() {
        if (unsubscribeAccount) unsubscribeAccount();
        if (unsubscribeAdminAccounts) unsubscribeAdminAccounts();
        if (unsubscribeFeedback) unsubscribeFeedback();
        unsubscribeAccount = null;
        unsubscribeAdminAccounts = null;
        unsubscribeFeedback = null;
        currentAccount = null;
        accounts = [];
        feedback = [];
        developer = false;
        renderManagedAccounts();
        renderManagedFeedback();
    }

    async function handleAuthState(user) {
        stopAccountListeners();
        currentUser = user;
        accountLoadError = '';
        updatePanel();
        renderRewards();
        if (!user) return;

        try {
            await firebase.reload(user);
            if (!user.emailVerified) {
                if (!registrationInProgress) {
                    notify('Ověřte svou e-mailovou adresu a znovu se přihlaste.');
                    await firebase.signOut(auth);
                }
                return;
            }
            await firebase.getIdToken(user, true);
            const profile = await ensureAccount(user);
            if (profile.disabled) {
                notify('Tento účet byl zablokován správcem.');
                await firebase.signOut(auth);
                return;
            }
            currentAccount = {
                id: user.uid,
                ...profile
            };
            const adminDoc = await firebase.getDoc(firebase.doc(database, 'admins', user.uid));
            developer = adminDoc.exists() && adminDoc.data().enabled === true;
            if (!developer &&
                user.email.toLocaleLowerCase('en-US') ===
                    window.CASINO_FIREBASE_CONFIG.developerEmail.toLocaleLowerCase('en-US')) {
                notify('Přihlášení root funguje, ale účet zatím nemá developerská oprávnění. Dokončete nastavení admins ve Firebase.');
            }

            const accountRef = firebase.doc(database, 'accounts', user.uid);
            unsubscribeAccount = firebase.onSnapshot(accountRef, (snapshot) => {
                if (!snapshot.exists()) {
                    currentAccount = null;
                    updatePanel();
                    renderRewards();
                    return;
                }
                const data = snapshot.data();
                if (data.disabled && !developer) {
                    notify('Tento účet byl zablokován správcem.');
                    void firebase.signOut(auth);
                    return;
                }
                currentAccount = { id: user.uid, ...data };
                updatePanel();
                renderRewards();
            }, (error) => {
                console.error('Nepodařilo se načíst hráčský účet.', error);
                accountLoadError = firebaseErrorMessage(error);
                updatePanel();
                notify(`Herní účet se nepodařilo načíst: ${accountLoadError}`);
            });

            if (developer) {
                await firebase.deleteDoc(firebase.doc(database, 'leaderboard', user.uid));
                const allAccounts = firebase.collection(database, 'accounts');
                unsubscribeAdminAccounts = firebase.onSnapshot(allAccounts, (snapshot) => {
                    accounts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                    renderManagedAccounts();
                }, (error) => {
                    console.error('Nepodařilo se načíst seznam účtů.', error);
                    notify(`Přístup k seznamu hráčů byl zamítnut: ${firebaseErrorMessage(error)}`);
                });
                const feedbackQuery = firebase.query(
                    firebase.collection(database, 'feedback'),
                    firebase.orderBy('createdAt', 'desc'),
                    firebase.limit(200)
                );
                unsubscribeFeedback = firebase.onSnapshot(feedbackQuery, (snapshot) => {
                    feedback = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                    renderManagedFeedback();
                }, (error) => {
                    console.error('Nepodařilo se načíst návrhy a hlášení.', error);
                    notify(`Hlášení a návrhy se nepodařilo načíst: ${firebaseErrorMessage(error)}`);
                });
            }
            updatePanel();
            renderRewards();
            renderManagedAccounts();
        } catch (error) {
            console.error('Nepodařilo se načíst účet z Firebase.', error);
            accountLoadError = firebaseErrorMessage(error);
            updatePanel();
            notify(`Přihlášení proběhlo, ale účet se nepodařilo načíst: ${accountLoadError}`);
        }
    }

    async function updateBalance(amount) {
        if (!await waitUntilReady()) return false;
        const user = currentUser;
        const account = currentAccount;
        if (!user || !account || developer) {
            notify('Pro hraní se přihlaste hráčským účtem.');
            return false;
        }
        if (!Number.isSafeInteger(amount) || amount === 0) {
            notify('Neplatná změna zůstatku.');
            return false;
        }
        const accountRef = firebase.doc(database, 'accounts', user.uid);
        const leaderboardRef = firebase.doc(database, 'leaderboard', user.uid);
        try {
            await firebase.runTransaction(database, async (transaction) => {
                const snapshot = await transaction.get(accountRef);
                if (!snapshot.exists()) throw new Error('Hráčský účet nebyl nalezen.');
                const profile = snapshot.data();
                const balance = profile.balance + amount;
                if (profile.disabled || balance < 0 || !Number.isSafeInteger(balance)) {
                    throw new Error('Změnu zůstatku nelze provést.');
                }
                transaction.update(accountRef, { balance });
                transaction.set(leaderboardRef, { name: profile.name, balance });
            });
            return true;
        } catch (error) {
            reportError('Nepodařilo se změnit zůstatek.', error);
            return false;
        }
    }

    async function getWager(inputId) {
        if (!await waitUntilReady()) return null;
        const account = currentAccount;
        if (!currentUser || !account || developer) {
            notify('Nejdříve se přihlaste hráčským účtem.');
            return null;
        }
        const input = document.getElementById(inputId);
        const wager = input ? Number(input.value) : 50;
        if (!Number.isSafeInteger(wager) || wager <= 0 || wager > Math.floor(Number.MAX_SAFE_INTEGER / 36)) {
            notify('Zadejte kladnou sázku v povoleném limitu.');
            return null;
        }
        if (wager > account.balance) {
            notify('Na tuto sázku nemáte dost kreditů.');
            return null;
        }
        return await updateBalance(-wager) ? wager : null;
    }

    async function payout(amount) {
        if (!await waitUntilReady()) return false;
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            notify('Výhra musí být kladné celé číslo.');
            return false;
        }
        return updateBalance(amount);
    }

    async function claimReward() {
        if (!await waitUntilReady()) return;
        if (!currentUser || !currentAccount || developer) return;
        const accountRef = firebase.doc(database, 'accounts', currentUser.uid);
        const leaderboardRef = firebase.doc(database, 'leaderboard', currentUser.uid);
        try {
            await firebase.runTransaction(database, async (transaction) => {
                const snapshot = await transaction.get(accountRef);
                if (!snapshot.exists()) throw new Error('Hráčský účet nebyl nalezen.');
                const account = snapshot.data();
                if (account.disabled) throw new Error('Tento účet byl zablokován.');
                const storedIndex = Number.isInteger(account.rewardIndex) ? account.rewardIndex : 0;
                const rewardIndex = storedIndex === REWARDS.length ? 0 : storedIndex;
                if (rewardIndex < 0 || rewardIndex >= REWARDS.length) {
                    throw new Error('Denní odměny nejsou dostupné.');
                }
                if (account.lastRewardAt &&
                    Date.now() < account.lastRewardAt.toMillis() + REWARD_INTERVAL) {
                    throw new Error('Další odměna ještě není připravená.');
                }
                const balance = account.balance + REWARDS[rewardIndex];
                if (!Number.isSafeInteger(balance)) throw new Error('Zůstatek je příliš vysoký.');
                const nextIndex = rewardIndex === REWARDS.length - 1
                    ? REWARDS.length
                    : rewardIndex + 1;
                transaction.update(accountRef, {
                    balance,
                    rewardIndex: nextIndex,
                    lastRewardAt: firebase.serverTimestamp()
                });
                transaction.set(leaderboardRef, { name: account.name, balance });
            });
            notify('Denní odměna byla připsána.');
        } catch (error) {
            reportError('Odměnu se nepodařilo vyzvednout.', error);
        }
    }

    function managedAccounts() {
        return accounts.map(({ unsubscribe, ...account }) => account);
    }

    async function updateManagedAccount(id, changes) {
        if (!await waitUntilReady()) return false;
        if (!developer) {
            notify('Tuto akci může provést pouze správce.');
            return false;
        }
        const account = accounts.find((item) => item.id === id);
        if (!account || !changes || typeof changes !== 'object') return false;
        const name = typeof changes.name === 'string' ? changes.name.trim() : account.name;
        const balance = changes.balance;
        const disabled = typeof changes.disabled === 'boolean' ? changes.disabled : account.disabled;
        if (!name || name.length > 24 || !Number.isSafeInteger(balance) || balance < 0) {
            notify('Zadejte platné herní jméno a nezáporný počet kreditů.');
            return false;
        }
        const accountRef = firebase.doc(database, 'accounts', id);
        const leaderboardRef = firebase.doc(database, 'leaderboard', id);
        try {
            await firebase.runTransaction(database, async (transaction) => {
                const snapshot = await transaction.get(accountRef);
                if (!snapshot.exists()) throw new Error('Hráčský účet nebyl nalezen.');
                transaction.update(accountRef, { name, balance, disabled });
                if (disabled) {
                    transaction.delete(leaderboardRef);
                } else {
                    transaction.set(leaderboardRef, { name, balance });
                }
            });
            notify('Účet byl upraven.');
            return true;
        } catch (error) {
            reportError('Účet se nepodařilo upravit.', error);
            return false;
        }
    }

    async function adjustManagedBalance(id, amount) {
        if (!await waitUntilReady()) return false;
        if (!developer) {
            notify('Tuto akci může provést pouze správce.');
            return false;
        }
        if (!Number.isSafeInteger(amount) || amount === 0) {
            notify('Zadejte platnou změnu kreditů.');
            return false;
        }
        const accountRef = firebase.doc(database, 'accounts', id);
        const leaderboardRef = firebase.doc(database, 'leaderboard', id);
        try {
            await firebase.runTransaction(database, async (transaction) => {
                const snapshot = await transaction.get(accountRef);
                if (!snapshot.exists()) throw new Error('Hráčský účet nebyl nalezen.');
                const account = snapshot.data();
                const balance = account.balance + amount;
                if (!Number.isSafeInteger(balance) || balance < 0) {
                    throw new Error('Zůstatek nemůže být záporný ani překročit povolený limit.');
                }
                transaction.update(accountRef, { balance });
                if (account.disabled) {
                    transaction.delete(leaderboardRef);
                } else {
                    transaction.set(leaderboardRef, { name: account.name, balance });
                }
            });
            notify(`${amount > 0 ? 'Připsáno' : 'Odečteno'} ${Math.abs(amount).toLocaleString('cs-CZ')} kreditů.`);
            return true;
        } catch (error) {
            reportError('Kredity se nepodařilo upravit.', error);
            return false;
        }
    }

    async function submitFeedback(type, title, details) {
        if (!await waitUntilReady()) return false;
        if (!currentUser || !currentAccount || developer) {
            notify('Pro odeslání hlášení nebo návrhu se přihlaste hráčským účtem.');
            return false;
        }
        const cleanTitle = typeof title === 'string' ? title.trim() : '';
        const cleanDetails = typeof details === 'string' ? details.trim() : '';
        if (!['bug', 'suggestion'].includes(type) ||
            !cleanTitle || cleanTitle.length > 100 ||
            !cleanDetails || cleanDetails.length > 1500) {
            notify('Zkontrolujte typ, nadpis (do 100 znaků) a popis (do 1 500 znaků).');
            return false;
        }
        try {
            await firebase.addDoc(firebase.collection(database, 'feedback'), {
                uid: currentUser.uid,
                name: currentAccount.name,
                type,
                title: cleanTitle,
                details: cleanDetails,
                status: 'new',
                createdAt: firebase.serverTimestamp()
            });
            notify('Děkujeme, zpráva byla odeslána.');
            return true;
        } catch (error) {
            console.error('Nepodařilo se odeslat hlášení nebo návrh.', error);
            notify(firebaseErrorMessage(error));
            return false;
        }
    }

    function managedFeedback() {
        return feedback.map(({ id, ...entry }) => ({ id, ...entry }));
    }

    async function updateFeedbackStatus(id, status) {
        if (!await waitUntilReady()) return false;
        if (!developer) {
            notify('Tuto akci může provést pouze správce.');
            return false;
        }
        if (!feedback.some((entry) => entry.id === id) ||
            !['new', 'reviewing', 'resolved', 'declined'].includes(status)) {
            notify('Neplatný stav hlášení.');
            return false;
        }
        try {
            await firebase.updateDoc(firebase.doc(database, 'feedback', id), { status });
            notify('Stav zprávy byl aktualizován.');
            return true;
        } catch (error) {
            reportError('Stav zprávy se nepodařilo změnit.', error);
            return false;
        }
    }

    function startFirebase() {
        const config = window.CASINO_FIREBASE_CONFIG;
        if (!config || !config.apiKey || !config.projectId || !config.appId) {
            throw new Error('Chybí Firebase konfigurace. Zkontrolujte soubor firebase-config.js.');
        }
        return Promise.all([
            import('https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js')
        ]).then(([appSdk, authSdk, firestoreSdk]) => {
            firebase = { ...authSdk, ...firestoreSdk };
            const app = appSdk.initializeApp(config);
            auth = authSdk.getAuth(app);
            database = firestoreSdk.getFirestore(app);
            listenToLeaderboard();
            authSdk.onAuthStateChanged(auth, (user) => {
                void handleAuthState(user).then(resolveReady).catch(rejectReady);
            });
        });
    }

    const toast = document.createElement('div');
    toast.id = 'casinoToast';
    toast.className = 'casino-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
    updatePanel();
    renderRewards();
    renderLeaderboard([]);

    window.CasinoApp = {
        ready,
        getAccount,
        getWager,
        payout,
        notify,
        isDeveloper,
        managedAccounts,
        updateManagedAccount,
        adjustManagedBalance,
        claimReward,
        submitFeedback,
        managedFeedback,
        updateFeedbackStatus
    };

    startFirebase().catch((error) => {
        reportError('Nepodařilo se připojit k Firebase.', error);
        rejectReady(error);
    });
})();
