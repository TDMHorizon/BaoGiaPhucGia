/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider } from "./lib/auth";
import { Toaster } from "./components/ui/sonner";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  );
}
