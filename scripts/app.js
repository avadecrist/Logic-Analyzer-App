const startStopButton = document.getElementById('startStop');
const dataDisplay = document.getElementById('channelData');

let isGettingData = false;

startStopButton.addEventListener('click', () => {
  // Logic to start data acquisition
  if (!isGettingData) {
    startStopButton.textContent = 'Stop';
    dataDisplay.textContent = 'Data acquisition started...';
    isGettingData = true;
  }
  else {
    // Stop the data acquisition process
    startStopButton.textContent = 'Start';
    dataDisplay.textContent = 'Data acquisition stopped.';
    isGettingData = false;
  }

});
