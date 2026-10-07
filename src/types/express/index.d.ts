import { AuthUser } from "../../../server/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
