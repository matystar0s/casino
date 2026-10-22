(function () {
    const ACCOUNTS_KEY = 'casinoDemoAccounts';
    const ACTIVE_ACCOUNT_KEY = 'casinoDemoActiveAccount';
    const STARTING_BALANCE = 1000;
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
            const topUpButton = document.createElement('button');
            topUpButton.type = 'button';
            topUpButton.className = 'button-secondary';
            topUpButton.textContent = 'Dobít +500 (demo)';
            topUpButton.addEventListener('click', () => {
                if (!Number.isSafeInteger(account.balance + 500)) {
                    notify('Zůstatek je příliš vysoký pro další dobití.');
                    return;
                }
                const previousBalance = account.balance;
                account.balance += 500;
                if (persist()) {
                    updatePanel();
                    notify('Připsáno 500 testovacích kreditů. Žádná platba neproběhla.');
                } else {
                    account.balance = previousBalance;
                }
            });
            actions.append(topUpButton);

            const logoutButton = document.createElement('button');
            logoutButton.type = 'button';
            logoutButton.className = 'button-quiet';
            logoutButton.textContent = 'Odhlásit';
            logoutButton.addEventListener('click', () => {
                const previousAccountId = activeAccountId;
                activeAccountId = '';
                if (persist()) {
                    updatePanel();
                    notify('Odhlášení proběhlo. Zůstatek účtu zůstává uložený.');
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
                )
                : [];
            activeAccountId = localStorage.getItem(ACTIVE_ACCOUNT_KEY) || '';
            if (!accounts.some((account) => account.id === activeAccountId)) {
                activeAccountId = '';
            }
        } catch (error) {
            console.error('Nepodařilo se načíst demo účet.', error);
            accounts = [];
            activeAccountId = '';
            notify('Uložená data účtu nelze přečíst. Zkontrolujte nastavení prohlížeče.');
        }
    }

    function getAccount() {
        return accounts.find((account) => account.id === activeAccountId) || null;
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
                    <p class="dialog-note">Účet a kredity se ukládají pouze v tomto prohlížeči. Nejde o skutečné peníze ani platební službu.</p>
                    <label for="accountName">Jméno účtu</label>
                    <input id="accountName" name="accountName" type="text" maxlength="24" autocomplete="nickname" required>
                    <p class="account-dialog-message" aria-live="polite"></p>
                    <div class="dialog-actions">
                        <button type="submit" name="action" value="create">Vytvořit účet (+1000)</button>
                        <button type="submit" name="action" value="login" class="button-secondary">Přihlásit se</button>
                    </div>
                    <p class="dialog-note">Demo účty nejsou chráněné heslem a nejsou určeny pro skutečné osobní údaje.</p>
                </form>`;
            document.body.append(dialog);
            dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) dialog.close();
            });
            dialog.querySelector('form').addEventListener('submit', (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const message = dialog.querySelector('.account-dialog-message');
                const nameInput = form.elements.accountName;
                const name = nameInput.value.trim();
                const action = event.submitter ? event.submitter.value : 'create';
                if (!name) {
                    message.textContent = 'Zadejte jméno účtu.';
                    return;
                }
                const id = name.toLocaleLowerCase('cs-CZ');
                const existing = accounts.find((account) => account.id === id);
                const previousAccountId = activeAccountId;
                let createdAccount = null;

                if (action === 'create') {
                    if (existing) {
                        message.textContent = 'Účet s tímto jménem už existuje. Přihlaste se.';
                        return;
                    }
                    createdAccount = { id, name, balance: STARTING_BALANCE };
                    accounts.push(createdAccount);
                    activeAccountId = id;
                } else {
                    if (!existing) {
                        message.textContent = 'Účet nebyl nalezen. Nejdříve si ho vytvořte.';
                        return;
                    }
                    activeAccountId = id;
                }

                if (persist()) {
                    updatePanel();
                    dialog.close();
                    notify(action === 'create'
                        ? 'Demo účet vytvořen. Máte 1000 testovacích kreditů.'
                        : `Přihlášení proběhlo. Vítejte zpět, ${existing ? existing.name : name}.`);
                } else {
                    activeAccountId = previousAccountId;
                    if (createdAccount) accounts = accounts.filter((account) => account !== createdAccount);
                }
            });
        }
        const current = getAccount();
        dialog.querySelector('#accountName').value = current ? current.name : '';
        dialog.querySelector('.account-dialog-message').textContent = '';
        dialog.showModal();
    }

    function getWager(inputId) {
        const account = getAccount();
        if (!account) {
            notify('Nejdříve se přihlaste nebo si vytvořte demo účet.');
            return null;
        }
        const input = document.getElementById(inputId);
        const wager = input ? Number(input.value) : 50;
        if (!Number.isSafeInteger(wager) || wager <= 0 || wager > Math.floor(Number.MAX_SAFE_INTEGER / 36)) {
            notify('Zadejte kladnou sázku v povoleném limitu.');
            return null;
        }
        if (wager > account.balance) {
            notify('Na tuto sázku nemáte dost kreditů. Dobijte si testovací kredity.');
            return null;
        }
        account.balance -= wager;
        if (!persist()) {
            account.balance += wager;
            return null;
        }
        updatePanel();
        return wager;
    }

    function payout(amount) {
        const account = getAccount();
        if (!account || !Number.isSafeInteger(amount) || amount <= 0) {
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

    window.CasinoApp = {
        getAccount,
        getWager,
        payout,
        notify
    };
})();
