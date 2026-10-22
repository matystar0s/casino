(function () {
    if (!window.CasinoApp.isDeveloper()) {
        window.CasinoApp.notify('Pro vstup do správy se přihlaste developerským účtem root.');
        window.setTimeout(() => {
            window.location.replace('index.html');
        }, 1400);
        return;
    }

    const accountList = document.getElementById('accountList');

    function renderAccounts() {
        accountList.replaceChildren();
        const accounts = window.CasinoApp.managedAccounts();
        if (!accounts.length) {
            const empty = document.createElement('p');
            empty.className = 'dialog-note';
            empty.textContent = 'Zatím nejsou vytvořené žádné hráčské účty.';
            accountList.append(empty);
            return;
        }

        accounts.forEach((account) => {
            const form = document.createElement('form');
            form.className = 'managed-account';
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const fields = new FormData(form);
                await window.CasinoApp.updateManagedAccount(account.id, {
                    name: fields.get('name'),
                    email: fields.get('email'),
                    balance: Number(fields.get('balance')),
                    password: fields.get('password')
                });
            });

            const heading = document.createElement('h3');
            heading.textContent = account.name;
            form.append(heading);

            [
                ['Herní jméno', 'name', account.name, 'text'],
                ['E-mail', 'email', account.email, 'email'],
                ['Kredity', 'balance', String(account.balance), 'number'],
                ['Nové heslo (volitelné)', 'password', '', 'password']
            ].forEach(([labelText, fieldName, value, type]) => {
                const label = document.createElement('label');
                label.textContent = labelText;
                const input = document.createElement('input');
                input.type = type;
                input.name = fieldName;
                input.value = value;
                input.required = true;
                if (fieldName === 'name') input.maxLength = 24;
                if (fieldName === 'password') {
                    input.minLength = 6;
                    input.autocomplete = 'new-password';
                    input.required = false;
                }
                if (fieldName === 'balance') {
                    input.min = '0';
                    input.step = '1';
                }
                label.append(input);
                form.append(label);
            });

            const actions = document.createElement('div');
            actions.className = 'managed-account-actions';
            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.textContent = 'Uložit změny';
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'button-secondary';
            deleteButton.textContent = 'Smazat účet';
            deleteButton.addEventListener('click', () => {
                if (window.confirm(`Opravdu chcete smazat účet ${account.name}?`)) {
                    window.CasinoApp.deleteManagedAccount(account.id);
                }
            });
            actions.append(saveButton, deleteButton);
            form.append(actions);
            accountList.append(form);
        });
    }

    document.addEventListener('casino:accounts-changed', renderAccounts);
    renderAccounts();
})();
