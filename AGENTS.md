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

- Native apps (capacitor.config.ts for Android/TV, electron/ for Windows) are thin wrappers that load the live site, so all access checks stay server-side.
- In-app notifications are written only by server code via notify.server.ts with a dedupe key; users can only read/mark their own.
