(() => {
    const machine = document.querySelector('.slot-machine');
    const lever = document.getElementById('machineLever');
    const spinButton = document.getElementById('spinButton');
    const stopButton = document.getElementById('stopButton');
    if (!machine || !lever || !spinButton || !stopButton) return;

    function pullLever() {
        machine.classList.remove('lever-pulled');
        void machine.offsetWidth;
        machine.classList.add('lever-pulled');
        window.setTimeout(() => machine.classList.remove('lever-pulled'), 360);
    }

    lever.addEventListener('click', () => {
        pullLever();
        if (spinButton.disabled) {
            window.stopSlot();
        } else {
            window.spinSlots();
        }
    });
    spinButton.addEventListener('click', pullLever);
    stopButton.addEventListener('click', pullLever);
})();
