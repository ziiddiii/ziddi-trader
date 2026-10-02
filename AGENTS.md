<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Platform editorial items live in `platform_content` with public published reads and admin-role-only writes, so media sections remain editable without redeploying.
- YouTube URLs are parsed into privacy-enhanced embeds and hosted media URLs are validated before rendering, so arbitrary content cannot inject an unsafe iframe.
- App emails go through src/lib/mailer.server.ts selected by EMAIL_PROVIDER (lovable default, smtp/resend/sendgrid/brevo/mailgun); keeps email working when self-hosted.
