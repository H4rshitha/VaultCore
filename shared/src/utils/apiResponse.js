export class ApiResponse {
  static success(res, message, data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  static created(res, message, data = null) {
    return this.success(res, message, data, 201);
  }

  static error(res, message, statusCode = 500, details = null) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
