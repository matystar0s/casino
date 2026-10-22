(async function () {
    await window.CasinoApp.ready;
    if (!window.CasinoApp.isDeveloper()) {
        window.CasinoApp.notify('Pro vstup do správy se přihlaste správcovským účtem root.');
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
            empty.textContent = 'Zatím nejsou vytvořené žádné účty hráčů.';
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
                    balance: Number(fields.get('balance')),
                    disabled: fields.get('disabled') === 'on'
                });
            });

            const heading = document.createElement('h3');
            heading.textContent = account.name;
            form.append(heading);

            const emailLabel = document.createElement('span');
            emailLabel.className = 'readonly-field';
            emailLabel.textContent = 'E-mail';
            const email = document.createElement('span');
            email.textContent = account.email;
            emailLabel.append(email);
            form.append(emailLabel);

            [
                ['Herní jméno', 'name', account.name, 'text'],
                ['Kredity', 'balance', String(account.balance), 'number']
            ].forEach(([labelText, fieldName, value, type]) => {
                const label = document.createElement('label');
                label.textContent = labelText;
                const input = document.createElement('input');
                input.type = type;
                input.name = fieldName;
                input.value = value;
                input.required = true;
                if (fieldName === 'name') input.maxLength = 24;
                if (fieldName === 'balance') {
                    input.min = '0';
                    input.step = '1';
                }
                label.append(input);
                form.append(label);
            });

            const disabledLabel = document.createElement('label');
            disabledLabel.className = 'checkbox-field';
            const disabled = document.createElement('input');
            disabled.type = 'checkbox';
            disabled.name = 'disabled';
            disabled.checked = account.disabled === true;
            const disabledText = document.createElement('span');
            disabledText.textContent = 'Zablokovaný účet';
            disabledLabel.append(disabled, disabledText);
            form.append(disabledLabel);

            const actions = document.createElement('div');
            actions.className = 'managed-account-actions';
            const saveButton = document.createElement('button');
            saveButton.type = 'submit';
            saveButton.textContent = 'Uložit změny';
            actions.append(saveButton);
            form.append(actions);
            accountList.append(form);
        });
    }

    document.addEventListener('casino:accounts-changed', renderAccounts);
    renderAccounts();
})().catch((error) => {
    console.error('Nepodařilo se otevřít správu účtů.', error);
    window.CasinoApp.notify('Správa účtů se nenačetla. Zkontrolujte přihlášení a pravidla Firebase.');
});
