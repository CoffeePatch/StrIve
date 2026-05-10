export const notifyInfo = (message) => {
  // Fallback notice; replace with toast system if available
  // Non-blocking alternative could be implemented via a lightweight banner
  // For now, use alert for visibility during integration
  // eslint-disable-next-line no-alert
  alert(message);
};

export const notifyError = (message) => {
  // eslint-disable-next-line no-alert
  alert(message);
};
