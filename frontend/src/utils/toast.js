import toast from 'react-hot-toast';

export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    duration: 4000,
    ...options,
  });
};

export const showError = (message, options = {}) => {
  return toast.error(message, {
    duration: 5000,
    ...options,
  });
};

export const showWarning = (message, options = {}) => {
  return toast(message, {
    icon: '⚠️',
    duration: 4500,
    style: {
      borderColor: '#f59e0b',
    },
    ...options,
  });
};

export const showInfo = (message, options = {}) => {
  return toast(message, {
    icon: 'ℹ️',
    duration: 4000,
    style: {
      borderColor: '#3b82f6',
    },
    ...options,
  });
};

export const showLoading = (message, options = {}) => {
  return toast.loading(message, {
    ...options,
  });
};

export const dismissToast = (id) => {
  if (id) {
    toast.dismiss(id);
  } else {
    toast.dismiss();
  }
};
