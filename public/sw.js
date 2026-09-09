// Service worker do Recon — só existe pra viabilizar o lembrete de
// check-in (Web Push). Não faz cache de nada, não deixa o site funcionar
// offline: só escuta notificações push chegando e mostra elas.

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }
  const titulo = dados.title || "Recon";
  const opcoes = {
    body: dados.body || "Não esquece de preencher seu check-in de hoje.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: dados.url || "/checkin" },
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/checkin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.includes(url) && "focus" in janela) return janela.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
