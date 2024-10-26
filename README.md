# Gestor de Contactos

Este projeto é um simples gestor de contactos que utiliza Node.js para o backend e HTML/JavaScript para o frontend.

## Requisitos

Antes de executar este projeto, certifique-se de que tem o seguinte software instalado no seu sistema:

- Node.js (versão 12.0 ou superior)
- npm (normalmente instalado com o Node.js)

## Instalação

1. Clone este repositório para a sua máquina local:

   ```
   git clone https://github.com/helderpgoncalves/whatsapp-sender.git
   ```

2. Navegue até à pasta do projeto:

   ```
   cd whatsapp-sender
   ```

3. Instale as dependências do projeto:
   ```
   npm install
   ```

## Execução do Projeto

1. Inicie o servidor:

   ```
   npm run dev
   ```

2. Abra o seu navegador e aceda a:
   ```
   http://localhost:3000
   ```

## Utilização

- Para adicionar um novo contacto, preencha o formulário e clique em "Adicionar Contacto".
- Para ver a lista de contactos, clique em "Mostrar Contactos".
- Os contactos são armazenados no ficheiro `contacts.txt`.
- O ficheiro `contacts.txt` é lido no início do script e os contactos são armazenados em memória.
- Para inserir contactos, clique em "Adicionar Contactos" e selecione o ficheiro `contacts.txt` no seu sistema de ficheiros, ou insira manualmente os contactos no ficheiro ou linha a linha.
- Para enviar mensagens, clique em "Enviar Mensagens".

## Formato dos Contactos

O ficheiro `contacts.txt` deve seguir um formato específico para que o sistema possa ler corretamente os contactos. Cada linha do ficheiro deve conter um contacto no seguinte formato:

```
+351912345678
+351923456789
+351934567890
```

Exemplo (baseado no `contacts-example.txt`):

```
+351912345678
+351923456789
+351934567890
```

Notas importantes:
- Inclua o código do país no número de telefone (por exemplo, 351 para Portugal).
- Não use caracteres especiais ou formatação no número de telefone.

## Estrutura do Projeto

- `server.js`: Contém o código do servidor Node.js.
- `public/index.html`: Página web principal com o formulário e a interface do utilizador.
- `contacts.txt`: Ficheiro onde os contactos são armazenados.
- `contacts-example.txt`: Ficheiro de exemplo mostrando o formato correto dos contactos.

## Notas

- Este é um projeto simples para fins educativos e não deve ser utilizado em ambiente de produção sem as devidas melhorias de segurança e desempenho.

## Contribuições

Contribuições são bem-vindas! Por favor, crie um "issue" ou um "pull request" para sugerir alterações ou melhorias.

## Licença

Este projeto está licenciado sob a licença MIT.
