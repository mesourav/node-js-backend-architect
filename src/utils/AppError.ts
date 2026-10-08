// An error we throw on purpose (e.g. 404, 400). The status code goes with it
// so the global error handler knows what to send to the client.
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
