import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* margin matches sidebar width via CSS: sidebar publishes its width through the fixed class */}
      <div className="flex flex-1 flex-col transition-[margin] duration-200 peer-collapsed:ml-16 ml-60 has-[~]:ml-60"
        style={{ marginLeft: "var(--sidebar-width, 15rem)" }}
      >
        <Header />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
