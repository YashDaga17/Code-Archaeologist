import "./globals.css";

export const metadata = {
  title: "Code Archaeologist — AI Development Intelligence",
  description: "Checkpoint-Native Developer Intelligence Platform. Reconstruct intent, verify implementation, detect missing requirements.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
