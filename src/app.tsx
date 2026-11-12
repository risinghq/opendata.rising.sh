import { createRouter } from "@solidjs/router";

function Home() {
  return (
    <main>
      <h1>Datos abiertos</h1>
      <p>Cifras de eventos públicos, cada una con sus fuentes.</p>
    </main>
  );
}

const Router = createRouter({
  routes: [{ path: "/", component: Home }],
});

export function App() {
  return <Router />;
}
