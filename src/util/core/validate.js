export const checkvaliddata = (email, password) => {
  const vaildemail = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email);
  const validpassword = /\d/.test(password);
  if (!vaildemail) {
    return "Invalid email or password";
  }
  if (!validpassword) {
    return "Invalid email or password";
  }
  return null;
};
