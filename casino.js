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
    let accounts = [];
    let unsubscribeAccount;
    let unsubscribeAdminAccounts;
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
            : 'Přihlaste se nebo si vytvořte účet';
        summary.append(name, balance);

        const actions = document.createElement('div');
        actions.className = 'account-actions';
        const accountButton = document.createElement('button');
        accountButton.type = 'button';
        accountButton.textContent = currentUser ? 'Účet' : 'Přihlásit / vytvořit účet';
        accountButton.addEventListener('click', openDialog);
        actions.append(accountButton);

        if (currentUser) {
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

        const currentIndex = currentAccount.rewardIndex || 0;
        const lastRewardAt = currentAccount.lastRewardAt;
        const lastRewardTime = lastRewardAt && typeof lastRewardAt.toMillis === 'function'
            ? lastRewardAt.toMillis()
            : null;
        const nextRewardTime = lastRewardTime === null ? Date.now() : lastRewardTime + REWARD_INTERVAL;
        const canClaim = Date.now() >= nextRewardTime;

        REWARDS.forEach((amount, index) => {
            const card = document.createElement('article');
            card.className = 'reward-card';
            const title = document.createElement('strong');
            title.textContent = `Den ${index + 1}`;
            const value = document.createElement('span');
            value.className = 'reward-value';
            value.textContent = `+${amount} kreditů`;
            const status = document.createElement('span');
            status.className = 'reward-status';
            const button = document.createElement('button');
            button.type = 'button';
            button.disabled = true;
            button.textContent = 'Zamčeno';

            if (index < currentIndex) {
                status.textContent = 'Vyzvednuto';
                button.textContent = 'Vyzvednuto';
            } else if (index === currentIndex && canClaim) {
                status.textContent = index === 0 && lastRewardTime === null
                    ? 'Otevřeno ihned'
                    : 'Odměna je připravena';
                button.disabled = developer;
                button.textContent = 'Vyzvednout';
                button.addEventListener('click', claimReward);
            } else if (index === currentIndex) {
                status.textContent = `Otevře se za ${formatCountdown(nextRewardTime - Date.now())}`;
                button.textContent = 'Čeká se';
            } else {
                status.textContent = 'Odemkne se po předchozí odměně';
            }
            card.append(title, value, status, button);
            cards.append(card);
        });
        rewardPanel.append(cards);

        if (currentIndex < REWARDS.length && !canClaim) {
            rewardTimer = window.setInterval(renderRewards, 1000);
        }
    }

    function renderManagedAccounts() {
        document.dispatchEvent(new CustomEvent('casino:accounts-changed'));
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
                    <input id="accountEmail" name="email" type="email" maxlength="254" autocomplete="username" required>
                    <label for="accountName">Herní jméno (při registraci)</label>
                    <input id="accountName" name="name" type="text" maxlength="24" autocomplete="nickname">
                    <label for="accountPassword">Heslo</label>
                    <input id="accountPassword" name="password" type="password" minlength="6" autocomplete="current-password" required>
                    <p class="account-dialog-message" aria-live="polite"></p>
                    <div class="dialog-actions">
                        <button type="submit" name="action" value="login" class="button-secondary">Přihlásit se</button>
                        <button type="submit" name="action" value="create">Vytvořit účet (+1000 kreditů)</button>
                    </div>
                    <p class="dialog-note">Při prvním přihlášení ověřeným e-mailem se vytvoří sdílený účet s 1000 testovacími kredity.</p>
                </form>`;
            document.body.append(dialog);
            dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) dialog.close();
            });
            dialog.querySelector('form').addEventListener('submit', async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const message = dialog.querySelector('.account-dialog-message');
                const submitButtons = Array.from(form.querySelectorAll('button[type="submit"]'));
                const email = form.elements.email.value.trim();
                const name = form.elements.name.value.trim();
                const password = form.elements.password.value;
                const action = event.submitter ? event.submitter.value : 'login';
                submitButtons.forEach((button) => { button.disabled = true; });
                try {
                    await ready;
                    if (action === 'create') {
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
            'auth/invalid-credential': 'Zadaný e-mail nebo heslo není správné.',
            'auth/invalid-email': 'Zadejte platnou e-mailovou adresu.',
            'auth/weak-password': 'Heslo musí mít alespoň 6 znaků.',
            'auth/too-many-requests': 'Příliš mnoho pokusů. Zkuste to později.',
            'auth/operation-not-allowed': 'Ve Firebase Console zapněte přihlášení e-mailem a heslem.',
            'permission-denied': 'Firebase zamítl přístup. Zkontrolujte nasazená pravidla Firestore.'
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
        unsubscribeAccount = null;
        unsubscribeAdminAccounts = null;
        currentAccount = null;
        accounts = [];
        developer = false;
        renderManagedAccounts();
    }

    async function handleAuthState(user) {
        stopAccountListeners();
        currentUser = user;
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
            }, (error) => reportError('Nepodařilo se načíst hráčský účet.', error));

            if (developer) {
                await firebase.deleteDoc(firebase.doc(database, 'leaderboard', user.uid));
                const allAccounts = firebase.collection(database, 'accounts');
                unsubscribeAdminAccounts = firebase.onSnapshot(allAccounts, (snapshot) => {
                    accounts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
                    renderManagedAccounts();
                }, (error) => reportError('Nepodařilo se načíst seznam účtů.', error));
            }
            updatePanel();
            renderRewards();
            renderManagedAccounts();
        } catch (error) {
            reportError('Nepodařilo se načíst účet z Firebase.', error);
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
                const rewardIndex = account.rewardIndex || 0;
                if (rewardIndex >= REWARDS.length) throw new Error('Denní odměny nejsou dostupné.');
                if (account.lastRewardAt &&
                    Date.now() < account.lastRewardAt.toMillis() + REWARD_INTERVAL) {
                    throw new Error('Další odměna ještě není připravená.');
                }
                const balance = account.balance + REWARDS[rewardIndex];
                const nextIndex = (rewardIndex + 1) % REWARDS.length;
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
        claimReward
    };

    startFirebase().catch((error) => {
        reportError('Nepodařilo se připojit k Firebase.', error);
        rejectReady(error);
    });
})();
