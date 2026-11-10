# Prazeres da Massa

Cardápio responsivo com React 19 + TypeScript, API em Cloudflare Workers e banco SQLite/D1. Preparado para um repositório privado no GitHub e para o plano gratuito da Cloudflare, dentro dos limites do plano. Não depende de Vercel, CounterAPI ou serviços de fontes externos em tempo de execução.

## Implantação desta loja

- Site publicado: https://prazeres-da-massa.prazeresdamassa.workers.dev
- Painel: https://prazeres-da-massa.prazeresdamassa.workers.dev/admin
- O Worker, o banco D1 e a limpeza diária já estão provisionados na conta Cloudflare da loja. Não recrie esses recursos para esta implantação.
- O segredo `SESSION_SECRET` já foi gerado e armazenado na Cloudflare, sem inclusão no código ou no GitHub.
- **Falta configurar `ADMIN_PASSWORD`.** No painel Cloudflare, abra Workers & Pages → prazeres-da-massa → Settings → Variables and Secrets → Add. Escolha o tipo Secret, nome `ADMIN_PASSWORD`, defina uma senha exclusiva de pelo menos 16 caracteres e salve/publice. Não compartilhe a senha pelo chat.
- Até essa configuração, a API bloqueia novos pedidos. Depois, ligue Receber pedidos no painel para abrir o atendimento.
- Esta publicação foi feita diretamente pela API, a partir do pacote versionado na branch `deploy/cloudflare` (commit `40b69451653e7694c46b6cf3526194f92ff85489`). A branch `feat/cardapio-cloudflare` contém as fontes. A publicação automática a partir do GitHub ainda não foi conectada.
- Site, painel e arquivos estáticos responderam aos testes HTTP. A API administrativa rejeitou acesso sem login, e o endpoint de pedidos recusou registros antes da definição da senha. Ainda é necessária a conferência visual em um navegador e um teste operacional após a configuração da senha.

Os passos de criação de recursos abaixo servem para uma nova instalação em outra conta. Para esta loja, use os recursos já existentes e a configuração de `wrangler.jsonc`.

## Menus, leitura e impressão de pedidos

Após adicionar panquecas ou bebidas, o cliente escolhe entre **Ir para o carrinho** (revisar e continuar a finalização existente) ou **Continuar comprando** (voltar ao início dos menus, na categoria selecionada). Nas bebidas, o seletor define apenas a quantidade a adicionar; o carrinho só muda após clicar em **Adicionar**. Dentro do carrinho, a quantidade das bebidas pode ser ajustada ou zerada para remoção.

O cardápio possui categorias Panquecas, Massas e Bebidas. A categoria Massas aguarda cadastro de pratos e preços; a mensagem de disponibilidade futura não aceita pedidos. Panquecas têm apenas massa tradicional e verde. Pedidos históricos com massa de beterraba continuam legíveis, mas a API não aceita novos pedidos dessa opção. Itens de beterraba de carrinhos salvos são removidos, preservando os outros itens válidos.

A interface e o painel usam Inter, do Google Fonts, com pesos 400–700, textos ampliados e contraste. Os arquivos são hospedados localmente; o cupom impresso mantém Arial para compatibilidade com drivers. No painel, cada pedido possui **Imprimir cupom**, que abre a janela nativa de impressão. O cupom contém cliente, endereço, referência, itens, adicionais, observações, forma de pagamento, situação e total registrado no banco. Não é documento fiscal e não comprova pagamento.

Para a Epson L355, selecione a impressora no diálogo do navegador, papel personalizado **102 × 152 mm**, orientação retrato, escala **100%** e desative cabeçalhos/rodapés do navegador. O CSS reserva 5 mm de margem por lado. Se o driver oferecer somente 10 × 15 cm (100 × 150 mm), crie o formato personalizado para corresponder à folha real. O site solicita o tamanho; o formato final e o alinhamento dependem do driver e do carregamento correto do papel. Pedidos extensos continuam em outras folhas, sem cortar o conteúdo. Faça a primeira impressão de conferência antes do uso diário. Não há impressão silenciosa ou acesso direto à impressora.

## Controle manual de atendimento

O bloqueio por relógio foi substituído pela chave **Receber pedidos**, no topo do painel administrativo. Ligado libera novos pedidos em qualquer horário; desligado pausa novos registros e preserva carrinhos e pedidos já existentes. A escolha é salva no D1, sem voltar automaticamente conforme os horários. Os horários exibidos no cardápio são apenas referência. O servidor verifica a chave a cada novo pedido; a vitrine consulta o estado a cada 30 segundos. Um pedido já registrado pode ser recuperado pela mesma tentativa mesmo após fechar a loja.

A migração `0002_shop_settings.sql` inicia a chave desligada. Somente administradores autenticados podem alterá-la; pedidos também precisam dos segredos administrativos configurados. A inserção verifica a chave no próprio SQL para evitar a aceitação de uma solicitação que chegou enquanto a loja estava sendo pausada.

## O que está pronto

- Identidade visual em creme, marrom e terracota; marca original preservada.
- Montagem de panquecas, seleção de bebidas e carrinho salvo no dispositivo.
- Promoção automática com cálculo em centavos: 2 por R$ 21,99, avulsa R$ 12,99; Coca-Cola tradicional R$ 6,00 e zero R$ 6,99.
- Horários calculados no servidor no fuso `America/Fortaleza`, de Chapadinha–MA (UTC−3): quarta e sexta 19h–23h, quinta/sábado/domingo 18h–22h, segunda e terça fechado.
- Banco com número único global (não reinicia a cada dia), idempotência, instantâneo do pedido e situação de atendimento.
- Validação de opções, quantidades, dados de entrega, preços e horários na API. Limite de 99 panquecas, 30 combinações e 99 unidades de cada bebida por pedido.
- Painel `/admin`: login, consulta paginada, confirmação, preparo, saída para entrega, conclusão e cancelamento.
- Senha do painel mantida em segredo no servidor, sessão assinada em cookie HttpOnly/Secure/SameSite, verificação de origem, limites de tentativas e cabeçalhos de segurança.
- Aviso de privacidade, dados pessoais restritos ao painel, eliminação automática dos registros após 90 dias e identificadores de rede resumidos por hash para limitação de tentativas.
- Sem armazenamento dos dados pessoais no localStorage. O navegador guarda o carrinho e um hash/chave de tentativa.

## Fluxo real de atendimento

1. O cliente monta o carrinho. Com a chave desligada ele pode montar, mas não registrar novos pedidos.
2. Com o atendimento ligado, preenche os dados. A API valida tudo, calcula o preço e grava o pedido como **aguardando confirmação**.
3. O site mostra o número e um botão para abrir o WhatsApp. O cliente precisa tocar em **enviar** no próprio WhatsApp.
4. A loja confirma disponibilidade e área de entrega. No painel, altera a situação do pedido e conversa com o cliente pelo WhatsApp.

O registro no banco NÃO comprova envio da mensagem, aceitação da loja ou pagamento. A loja pode ver registros de clientes que não terminaram o contato. O painel não envia mensagens automáticas nem possui acompanhamento público. A lista é atualizada pelo botão **Atualizar lista**; a filtragem é aplicada aos registros carregados, e o botão de paginação carrega os anteriores.

Pix e cartão são formas de pagamento informadas. Não há checkout financeiro, geração de Pix dinâmico, captura de cartão ou confirmação automática. A chave Pix é exibida com orientação de aguardar a confirmação da loja. A cobertura de entrega é verificada manualmente; não há mapa ou geocodificação.

## Requisitos

- Node.js 22.12 ou superior, Git, conta gratuita no GitHub e conta Cloudflare.
- Ative a verificação em duas etapas nas contas administrativas.
- Nenhum segredo deve ser colado em conversas, código, commits ou arquivos enviados ao GitHub.

## 1. Executar no computador

Extraia o projeto e execute, dentro da pasta:

```sh
npm ci
```

Copie `.dev.vars.example` para `.dev.vars` e substitua os dois valores. Use uma senha administrativa aleatória de pelo menos 16 caracteres e um segredo de sessão diferente, aleatório, de pelo menos 32 caracteres. O arquivo `.dev.vars` é ignorado pelo Git. Para gerar um valor localmente:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Não compartilhe o resultado. Para criar o banco local e iniciar a aplicação completa:

```sh
npm run db:local
npm run preview
```

Abra o endereço informado pelo Wrangler. O modo local usa um banco separado do banco da loja. O Wrangler fornece suporte a cookies Secure em localhost; utilize o hostname `localhost` para testar o painel. Se necessário, execute `npx wrangler dev --local --local-protocol https` para testar com HTTPS local.

`npm run dev` serve somente a interface com Vite, sem a API; use `npm run preview` para o fluxo completo. Não modifique o horário do computador para testar a operação real. Os testes automatizados controlam as datas sem interferir em produção.

## 2. Criar o banco de produção na Cloudflare

No seu computador:

```sh
npx wrangler login
npx wrangler d1 create prazeres-da-massa
```

O primeiro comando abre o navegador para autorizar sua conta. O segundo informa um `database_id`. Edite `wrangler.jsonc` e substitua `SUBSTITUA_PELO_ID_DO_BANCO_D1` pelo ID recebido, preservando `binding: "DB"`.

Se o nome do Worker estiver indisponível na sua conta, altere `name` em `wrangler.jsonc`. Esse nome também compõe o endereço público. O ID do banco não é uma senha; a autorização depende da sua conta Cloudflare.

Agora aplique a migração no banco remoto:

```sh
npm run db:remote
```

## 3. Verificar e publicar

```sh
npm test
npm run deploy
```

O deploy informa o endereço `https://<nome>.<subdominio-da-conta>.workers.dev`. Configure os segredos da produção pelo terminal, digitando os valores quando solicitados:

```sh
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Use os mesmos critérios de tamanho descritos acima. Os exemplos não são senhas de produção. Até os segredos serem configurados corretamente, o painel fica bloqueado. A troca de `SESSION_SECRET` invalida as sessões anteriores.

Abra `/admin` nesse endereço e verifique o login antes de divulgar o site. Confira o cron diário na seção **Triggers/Cron Triggers** da Cloudflare; ele executa a limpeza às 07h UTC (04h em Chapadinha). Não publique um domínio no GitHub Pages: esta aplicação precisa da API e do D1 para registrar pedidos.

## 4. Guardar no GitHub

Crie um repositório **privado**, sem arquivos iniciais, pelo GitHub. Na pasta do projeto:

```sh
git init
git add .
git commit -m "Cria cardapio e gestao de pedidos"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/prazeres-da-massa.git
git push -u origin main
```

Substitua `SEU_USUARIO`. A autenticação deve ser feita pelo gerenciador de credenciais ou GitHub CLI no seu computador. Nunca coloque token no endereço remoto.

`.gitignore` exclui dependências, banco local, artefatos de compilação, `.dev.vars` e `.env`. Envie `package-lock.json`: ele fixa as versões instaladas.

## 5. Atualizações automáticas a partir do GitHub (opcional)

Na Cloudflare, abra seu Worker e conecte o repositório em **Settings → Builds → Connect**. Autorize apenas o repositório necessário. Configure:

- Branch de produção: `main`.
- Comando de build: `npm ci && npm test && npm run build`.
- Comando de deploy: `npx wrangler deploy`.
- Diretório raiz: a pasta que contém `package.json` (raiz se os arquivos forem enviados diretamente).
- Use Node.js 22.12 ou superior.

O build do Git não precisa receber a senha do painel. Os segredos pertencem ao Worker de produção. Se forem adicionadas novas migrações no futuro, aplique-as com `npm run db:remote` **antes** de publicar a versão que depende delas. Não altere uma migração já aplicada: adicione uma nova.

## Operação e configuração

- Catálogo, preços, horários, WhatsApp e Pix: `shared/domain.ts`.
- Componentes e textos: `src/main.tsx`.
- Estilos próprios: `src/styles.css`. Não há dependência de Tailwind neste projeto.
- API, autorização e política de retenção: `worker/index.ts`.
- Logo atual: `public/logo-nova.png`, enviada pelo proprietário. Fonte Inter hospedada localmente com licença OFL em `public/fonts`.
- O cardápio é publicado no build. O painel gerencia os pedidos; não inclui edição de catálogo, estoque, várias contas, notificações automáticas, emissão fiscal ou conciliação financeira.
- O relógio do cliente não decide se um pedido pode ser registrado: a API é a autoridade. A interface consulta o servidor a cada 30 segundos.
- O número do pedido é uma sequência global única; eventuais intervalos na sequência são normais. A limpeza não reinicia a sequência.
- Uma nova tentativa com a mesma chave e dados retorna o registro existente. Alterar os dados gera outra tentativa. Abrir o fluxo em outro dispositivo não equivale à mesma tentativa.
- Se o armazenamento do navegador falhar, o site informa que o carrinho só está disponível enquanto a página permanecer aberta.
- O estado do pedido só pode avançar de forma válida. Cancelamento e conclusão são finais; para um novo atendimento, faça novo pedido.
- Endereços, notas e nomes são renderizados como texto pelo React, nunca como HTML fornecido pelo usuário.

## Custos e limites

O código é seu. O GitHub permite repositórios privados no plano gratuito. Cloudflare Workers e D1 oferecem franquias gratuitas; uso acima dos limites pode bloquear operações ou exigir mudança de plano. Verifique os termos e as franquias atuais antes de publicar:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://github.com/pricing

Você pode usar o endereço `workers.dev` sem comprar domínio. Domínio próprio é opcional e geralmente pago. Provedores de pagamento e WhatsApp Business Platform, se integrados futuramente, têm condições e possíveis tarifas próprias. O link simples `wa.me` usado aqui não depende dessa API.

## Validação entregue

- `npm run build`: compilação TypeScript e build de produção aprovados.
- `npm test`: testes das regras de preço/horário/validação e testes da API com SQLite real em memória, incluindo idempotência, autenticação, transições de estado e bloqueio de abuso.
- `wrangler deploy --dry-run`: pacote de Worker e bindings validados sem publicação.
- `wrangler d1 migrations apply DB --local`: migração aplicada com sucesso ao D1 local.

Não foi realizada validação visual ou interação em navegador nesta sessão, pois o controle do navegador do ambiente não estava disponível. Os testes de API usam um adaptador SQLite: não substituem a conferência final no D1 remoto. A publicação de produção e a verificação no D1 remoto ainda precisam ser concluídas na conta Cloudflare da loja.

## Conferência final na sua conta

Antes de divulgar o endereço, faça um pedido identificado como teste durante o atendimento e confirme: recálculo da promoção, dados no painel, abertura e envio manual da mensagem, mudança de situação e carrinho após atualizar a página. Cancele o pedido de teste no painel. Fora do horário, confira que o registro fica indisponível. Teste também em um celular real.

O aviso de privacidade fornecido descreve o comportamento implementado; ajuste-o se o uso dos dados ou a operação da loja mudar. As mensagens no WhatsApp e dados mantidos em outros sistemas não são apagados pelo cron deste site. Não há rotina de backup externo configurada: use as opções de recuperação/exportação do D1 conforme a necessidade do negócio e a política de retenção.

## Identidade Massas Artesanais

Banner com “Massas Artesanais”, título “Seu sabor. Suas escolhas. Seu pedido.”, instruções de personalização e CTA “Monte seu pedido!”. O preço sobreposto foi removido do banner, preservando preços no catálogo e no carrinho. Adicionais em destaque e lixeira explícita para remover cada refrigerante do carrinho. Inter (Google Fonts) hospedada localmente com licença OFL.

Logo recebida pelo GitHub em `public/logo-nova.png`. O banner exibe a arte inteira, sem recorte e sem preço sobreposto. O arquivo também é usado como ícone do site. Os preços dos produtos e as regras de promoção no carrinho continuam válidos.

## Endereço e rótulos da finalização

O cliente informa Rua / Avenida e Número separadamente; Número é obrigatório e aceita complementos como 123-B ou S/N. Os dados são validados na API e armazenados no JSON do pedido, sem alterar pedidos históricos. Painel, mensagem WhatsApp e cupom exibem rua e número juntos; registros antigos continuam mostrando o endereço original. Botões: Adicionar ao carrinho, Finalizar Pedido e Concluir pedido.

## Mensagens preparadas de atualização

Ao avançar o pedido pelos botões Confirmar, Em preparo, Saiu para entrega e Concluído, a confirmação oferece **Salvar e abrir WhatsApp**. O status é salvo primeiro. Depois o WhatsApp do cliente recebe o texto preparado com nome, número do pedido e etapa. A equipe precisa tocar em Enviar. O site não afirma que a mensagem foi enviada ou entregue. Se a abertura for bloqueada, um link permanece disponível para abrir manualmente. Se a alteração falhar, a aba de espera é fechada e o WhatsApp não abre. Cancelamento não possui mensagem automática preparada. Não há integração com API paga ou envio em segundo plano.

## Teste opcional de localização

Use https://prazeres-da-massa.prazeresdamassa.workers.dev/?teste=mapa para o teste. O endereço sem query continua com o formulário sem mapa. O teste é público e usa o MESMO banco e a MESMA chave de atendimento: pedidos de teste aparecem no painel normal e devem conter “TESTE — NÃO PREPARAR”. Não há ambiente de dados isolado.

Na versão de teste, o mapa aparece diretamente na tela de entrega. A caixa Usar minha localização controla o envio: marcada inclui o ponto e acompanha qualquer ajuste do marcador; desmarcada remove as coordenadas. Marcar sem um ponto selecionado solicita GPS mediante permissão; se negado, selecione manualmente ou desmarque. Clique, arraste ou marque o centro com o teclado. Não há botão de confirmação do ponto. Resultados atrasados do GPS são ignorados após desmarcar ou escolher manualmente outro local. O mapa é opcional, e rua/número/bairro continuam obrigatórios. Não há geocodificação, roteamento, rastreamento ou validação automática da cobertura.

As coordenadas são validadas no servidor, guardadas no JSON do pedido e expostas apenas ao painel autenticado e à mensagem WhatsApp do pedido. Pedidos antigos continuam funcionando e sem coordenadas. Os dados seguem a retenção de 90 dias; localização não é salva no localStorage. No painel, Abrir ponto de entrega no mapa usa Google Maps.

Tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png, atribuição visível, HTTPS, referer de origem, cache normal do navegador, sem prefetch/offline. O serviço tem uso comunitário limitado e não garante disponibilidade: https://operations.osmfoundation.org/policies/tiles/. Em uso elevado, contratar provedor de tiles ou infraestrutura própria. O teste não realiza chamadas pagas nem exige chave de API.

Para voltar ao fluxo sem mapa, abra o endereço normal ou clique no link da faixa de teste. Para reverter o código, a tag `antes-do-teste-mapa-20261110` preserva a versão anterior; não restaure/apague o banco. As novas coordenadas em pedidos existentes podem continuar armazenadas até a expiração normal, sem afetar o endereço textual.

Validação: build e 17 testes aprovados. O teste adicional verifica coordenadas, arredondamento, rejeição de limites inválidos e inclusão da localização no WhatsApp. GPS e interação real em celular ainda precisam de conferência; o controle de navegador do ambiente não está disponível.

### Conclusão do pedido no teste

No link ?teste=mapa, Concluir pedido grava normalmente no painel e mostra o número/total com a mensagem de aguardar confirmação da loja pelo WhatsApp, sem botão para o cliente enviar o pedido. O endereço normal sem query preserva o fluxo anterior. Se a caixa estiver marcada sem um ponto válido, o formulário pede para marcar um local ou desmarcar antes de concluir. O teste continua compartilhando os dados e o atendimento reais da loja.
