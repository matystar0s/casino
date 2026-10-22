(function () {
    const ACCOUNTS_KEY = 'casinoDemoAccounts';
    const ACTIVE_ACCOUNT_KEY = 'casinoDemoActiveAccount';
    const STARTING_BALANCE = 1000;
    const DEVELOPER_ID = 'developer';
    const accountPanel = document.getElementById('casinoAccount');
    let accounts = [];
    let activeAccountId = '';
    let dialog;

    function notify(message) {
        const toast = document.getElementById('casinoToast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('visible');
        window.clearTimeout(notify.timer);
        notify.timer = window.setTimeout(() => toast.classList.remove('visible'), 3200);
    }

    function persist() {
        try {
            localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
            if (activeAccountId) {
                localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeAccountId);
            } else {
                localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
            }
            return true;
        } catch (error) {
            console.error('Nepodařilo se uložit demo účet.', error);
            notify('Účet se nepodařilo uložit do tohoto prohlížeče.');
            return false;
        }
    }

    function getAccount() {
        return accounts.find((account) => account.id === activeAccountId) || null;
    }

    function isDeveloper() {
        return getAccount()?.role === 'developer';
    }

    function updatePanel() {
        if (!accountPanel) return;
        accountPanel.replaceChildren();
        const account = getAccount();
        const summary = document.createElement('div');
        summary.className = 'account-summary';
        const name = document.createElement('strong');
        name.textContent = account ? account.name : 'Demo účet';
        const balance = document.createElement('span');
        balance.textContent = account
            ? `${account.balance.toLocaleString('cs-CZ')} kreditů`
            : 'Přihlaste se nebo si vytvořte účet';
        summary.append(name, balance);

        const actions = document.createElement('div');
        actions.className = 'account-actions';
        const accountButton = document.createElement('button');
        accountButton.type = 'button';
        accountButton.textContent = account ? 'Účet' : 'Přihlásit / vytvořit účet';
        accountButton.addEventListener('click', openDialog);
        actions.append(accountButton);

        if (account) {
            if (isDeveloper()) {
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
            logoutButton.addEventListener('click', () => {
                const previousAccountId = activeAccountId;
                activeAccountId = '';
                if (persist()) {
                    updatePanel();
                    notify('Odhlášení proběhlo.');
                } else {
                    activeAccountId = previousAccountId;
                }
            });
            actions.append(logoutButton);
        }

        accountPanel.append(summary, actions);
    }

    function load() {
        try {
            const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
            accounts = Array.isArray(storedAccounts)
                ? storedAccounts.filter((account) =>
                    account && typeof account.id === 'string' &&
                    typeof account.name === 'string' &&
                    Number.isSafeInteger(account.balance) && account.balance >= 0
                ).map((account) => ({
                    ...account,
                    email: typeof account.email === 'string' ? account.email : '',
                    passwordHash: typeof account.passwordHash === 'string' ? account.passwordHash : '',
                    role: account.role === 'developer' ? 'developer' : 'player'
                }))
                : [];
            let developer = accounts.find((account) => account.id === DEVELOPER_ID);
            if (!developer) {
                developer = {
                    id: DEVELOPER_ID,
                    name: 'root',
                    email: 'root',
                    passwordHash: '',
                    balance: 0,
                    role: 'developer'
                };
                accounts.push(developer);
            }
            developer.name = 'root';
            developer.email = 'root';
            developer.role = 'developer';
            activeAccountId = localStorage.getItem(ACTIVE_ACCOUNT_KEY) || '';
            if (!accounts.some((account) => account.id === activeAccountId)) {
                activeAccountId = '';
            }
            persist();
        } catch (error) {
            console.error('Nepodařilo se načíst demo účet.', error);
            accounts = [];
            activeAccountId = '';
            notify('Uložená data účtu nelze přečíst. Zkontrolujte nastavení prohlížeče.');
        }
    }

    async function hashPassword(password) {
        if (!window.crypto?.subtle) {
            throw new Error('Pro přihlášení je potřeba zabezpečené připojení HTTPS.');
        }
        const bytes = new TextEncoder().encode(password);
        const hash = await window.crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    function openDialog() {
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.className = 'account-dialog';
            dialog.innerHTML = `
                <form class="account-form">
                    <button class="dialog-close" type="button" aria-label="Zavřít">×</button>
                    <p class="eyebrow">Online kasino · demo</p>
                    <h2>Váš herní účet</h2>
                    <p class="dialog-note">Demo účet a kredity se ukládají pouze v tomto prohlížeči. E-mail se neověřuje a nejde o skutečné peníze.</p>
                    <label for="accountEmail">E-mail nebo developerské jméno</label>
                    <input id="accountEmail" name="email" type="text" maxlength="254" autocomplete="username" required>
                    <label for="accountName">Herní jméno (pouze při registraci)</label>
                    <input id="accountName" name="name" type="text" maxlength="24" autocomplete="nickname">
                    <label for="accountPassword">Heslo</label>
                    <input id="accountPassword" name="password" type="password" minlength="6" autocomplete="current-password" required>
                    <p class="account-dialog-message" aria-live="polite"></p>
                    <div class="dialog-actions">
                        <button type="submit" name="action" value="login" class="button-secondary">Přihlásit se</button>
                        <button type="submit" name="action" value="create">Vytvořit účet (+1000 kreditů)</button>
                    </div>
                    <p class="dialog-note">Vstup do developerského dema: jméno root, heslo rootroot.</p>
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
                const email = form.elements.email.value.trim().toLocaleLowerCase('en-US');
                const name = form.elements.name.value.trim();
                const password = form.elements.password.value;
                const action = event.submitter ? event.submitter.value : 'login';
                const previousAccountId = activeAccountId;

                if (email === 'root' && action === 'login') {
                    if (password !== 'rootroot') {
                        message.textContent = 'Neplatné přihlašovací údaje.';
                        return;
                    }
                    activeAccountId = DEVELOPER_ID;
                } else if (action === 'create') {
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        message.textContent = 'Zadejte platnou e-mailovou adresu.';
                        return;
                    }
                    if (email === 'root' || !name) {
                        message.textContent = 'Zadejte e-mail a herní jméno.';
                        return;
                    }
                    if (password.length < 6) {
                        message.textContent = 'Heslo musí mít alespoň 6 znaků.';
                        return;
                    }
                    if (accounts.some((account) => account.email.toLocaleLowerCase('en-US') === email)) {
                        message.textContent = 'Účet s tímto e-mailem už existuje. Přihlaste se.';
                        return;
                    }
                    try {
                        const passwordHash = await hashPassword(password);
                        const id = `player-${window.crypto.randomUUID()}`;
                        const createdAccount = {
                            id,
                            email,
                            name,
                            passwordHash,
                            balance: STARTING_BALANCE,
                            role: 'player'
                        };
                        const previousAccountId = activeAccountId;
                        accounts.push(createdAccount);
                        activeAccountId = id;
                        if (persist()) {
                            updatePanel();
                            dialog.close();
                            notify('Demo účet vytvořen. Máte 1000 testovacích kreditů.');
                            renderLeaderboard();
                        } else {
                            activeAccountId = previousAccountId;
                            accounts = accounts.filter((account) => account !== createdAccount);
                        }
                    } catch (error) {
                        console.error('Nepodařilo se vytvořit demo účet.', error);
                        message.textContent = error.message;
                    }
                    return;
                } else {
                    const existing = accounts.find((account) =>
                        account.email.toLocaleLowerCase('en-US') === email && account.role !== 'developer'
                    );
                    if (!existing) {
                        message.textContent = 'Účet nebyl nalezen. Nejdříve si ho vytvořte.';
                        return;
                    }
                    try {
                        if (!existing.passwordHash || await hashPassword(password) !== existing.passwordHash) {
                            message.textContent = 'Neplatné přihlašovací údaje.';
                            return;
                        }
                    } catch (error) {
                        console.error('Nepodařilo se ověřit demo účet.', error);
                        message.textContent = error.message;
                        return;
                    }
                    activeAccountId = existing.id;
                }

                if (persist()) {
                    updatePanel();
                    dialog.close();
                    notify(`Přihlášení proběhlo. Vítejte, ${getAccount().name}.`);
                } else {
                    activeAccountId = previousAccountId;
                }
            });
        }
        const current = getAccount();
        dialog.querySelector('#accountEmail').value = current ? current.email : '';
        dialog.querySelector('#accountName').value = '';
        dialog.querySelector('#accountPassword').value = '';
        dialog.querySelector('.account-dialog-message').textContent = '';
        dialog.showModal();
    }

    function renderLeaderboard() {
        const leaderboard = document.getElementById('leaderboard');
        if (!leaderboard) return;
        const players = accounts
            .filter((account) => account.role !== 'developer')
            .sort((first, second) => second.balance - first.balance || first.name.localeCompare(second.name, 'cs-CZ'));
        leaderboard.replaceChildren();
        if (!players.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            empty.textContent = 'Zatím tu nejsou žádné hráčské účty. Zaregistrujte se a buďte první!';
            leaderboard.append(empty);
            return;
        }
        const list = document.createElement('ol');
        list.className = 'leaderboard-list';
        players.slice(0, 10).forEach((player) => {
            const item = document.createElement('li');
            const playerName = document.createElement('strong');
            playerName.textContent = player.name;
            const playerBalance = document.createElement('span');
            playerBalance.textContent = `${player.balance.toLocaleString('cs-CZ')} kreditů`;
            item.append(playerName, playerBalance);
            list.append(item);
        });
        leaderboard.append(list);
    }

    function getWager(inputId) {
        const account = getAccount();
        if (!account || account.role === 'developer') {
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
            notify('Na tuto sázku nemáte dost kreditů. Požádejte správce o připsání kreditů.');
            return null;
        }
        account.balance -= wager;
        if (!persist()) {
            account.balance += wager;
            return null;
        }
        updatePanel();
        renderLeaderboard();
        return wager;
    }

    function payout(amount) {
        const account = getAccount();
        if (!account || account.role === 'developer' || !Number.isSafeInteger(amount) || amount <= 0) {
            notify('Výhru se nepodařilo připsat. Zkontrolujte svůj demo účet.');
            return false;
        }
        if (!Number.isSafeInteger(account.balance + amount)) {
            notify('Výhru se nepodařilo připsat kvůli limitu zůstatku.');
            return false;
        }
        account.balance += amount;
        if (!persist()) {
            account.balance -= amount;
            return false;
        }
        updatePanel();
        renderLeaderboard();
        return true;
    }

    function managedAccounts() {
        return accounts.filter((account) => account.role !== 'developer');
    }

    async function updateManagedAccount(id, changes) {
        if (!isDeveloper()) {
            notify('Tuto akci může provést pouze developer.');
            return false;
        }
        const account = accounts.find((item) => item.id === id && item.role !== 'developer');
        if (!account || !changes || typeof changes !== 'object') return false;
        const email = typeof changes.email === 'string' ? changes.email.trim().toLocaleLowerCase('en-US') : account.email;
        const name = typeof changes.name === 'string' ? changes.name.trim() : account.name;
        const balance = changes.balance;
        const newPassword = typeof changes.password === 'string' ? changes.password : '';
        if (!name || name.length > 24 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !Number.isSafeInteger(balance) || balance < 0 || (newPassword && newPassword.length < 6)) {
            notify('Zkontrolujte jméno, e-mail, počet kreditů a délku nového hesla.');
            return false;
        }
        if (accounts.some((item) => item.id !== id && item.email.toLocaleLowerCase('en-US') === email)) {
            notify('Účet s tímto e-mailem už existuje.');
            return false;
        }
        const previous = {
            name: account.name,
            email: account.email,
            balance: account.balance,
            passwordHash: account.passwordHash
        };
        try {
            Object.assign(account, {
                name,
                email,
                balance,
                ...(newPassword ? { passwordHash: await hashPassword(newPassword) } : {})
            });
        } catch (error) {
            console.error('Nepodařilo se změnit heslo demo účtu.', error);
            notify(error.message);
            return false;
        }
        if (!persist()) {
            Object.assign(account, previous);
            return false;
        }
        updatePanel();
        renderLeaderboard();
        document.dispatchEvent(new CustomEvent('casino:accounts-changed'));
        notify('Účet byl upraven.');
        return true;
    }

    function deleteManagedAccount(id) {
        if (!isDeveloper()) {
            notify('Tuto akci může provést pouze developer.');
            return false;
        }
        const account = accounts.find((item) => item.id === id && item.role !== 'developer');
        if (!account) return false;
        accounts = accounts.filter((item) => item !== account);
        if (!persist()) {
            accounts.push(account);
            return false;
        }
        renderLeaderboard();
        document.dispatchEvent(new CustomEvent('casino:accounts-changed'));
        notify('Účet byl odstraněn.');
        return true;
    }

    const toast = document.createElement('div');
    toast.id = 'casinoToast';
    toast.className = 'casino-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.append(toast);
    load();
    updatePanel();
    renderLeaderboard();

    window.CasinoApp = {
        getAccount,
        getWager,
        payout,
        notify,
        isDeveloper,
        managedAccounts,
        updateManagedAccount,
        deleteManagedAccount
    };
})();
