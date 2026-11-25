# Private Railway deployment

The app runs as one Node.js service. The repository includes a Dockerfile and a Railway health-check configuration. A real Railway workspace, GitHub repository access and deployment verification are still required.

1. In Railway, choose a workspace on the Free plan and connect only `Aarya01239/venky-analytics` to the project. Select the tested branch `development/learning-studios`.
2. Attach the service's persistent volume at `/app/data`. Keep one replica. The server uses Railway's `RAILWAY_VOLUME_MOUNT_PATH` and stops during startup if the mount is missing or unwritable.
3. Generate a unique random workspace password in a password manager, with at least 24 characters. Set `VOS_ACCESS_USER` and `VOS_ACCESS_PASSWORD` in Railway Variables. Leave `GEMINI_API_KEY` unset if you want to use only curated practice.
4. Deploy, then generate the Railway HTTPS domain. Check that `/healthz` responds with HTTP 204, and that the home page and `/api/bootstrap` require the workspace credentials. Sign in with the browser prompt and confirm the dashboard loads.
5. Complete a SQL challenge, restart the deployed service, and confirm the verification badge is still present. This confirms the app uses the attached volume. For existing workspace data, stage a verified SQLite backup through a private transfer and follow the [recovery procedure](development-progress.md#deployment-and-recovery).

The documentation currently lists one 0.5 GB volume and $1 of monthly resource usage on the Free plan. Services can sleep and become unavailable when the allowance runs out. Check the account's actual plan and usage before publishing.

- [Railway Free plan](https://docs.railway.com/pricing/free-plan)
- [Volumes](https://docs.railway.com/volumes/reference)
- [Health checks](https://docs.railway.com/deployments/healthchecks)
- [Dockerfile builds](https://docs.railway.com/builds/dockerfiles)
