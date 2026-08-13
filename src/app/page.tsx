import { redirect } from "next/navigation";

// A home era só um menu repetindo a barra de navegação. A rota continua
// existindo porque é o start_url do PWA (o atalho na tela inicial abre
// nela) — só que agora cai direto no painel.
export default function HomePage() {
  redirect("/insights");
}
