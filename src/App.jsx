import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Lesson from "./pages/Lesson";
import Practice from "./pages/Practice";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/lesson/:id"
          element={<Lesson />}
        />

        <Route
          path="/practice/:id"
          element={<Practice />}
        />

      </Routes>
    </BrowserRouter>
  );
}