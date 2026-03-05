import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders solitaire controls", () => {
  render(<App />);
  expect(screen.getByText(/mobile solitaire/i)).toBeInTheDocument();
  expect(screen.getAllByText(/new/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/undo/i)[0]).toBeInTheDocument();
  expect(screen.getAllByText(/hint/i)[0]).toBeInTheDocument();
});
