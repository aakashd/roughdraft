export { ROUGHDRAFT_DEFAULT_PORT } from "../defaults.mjs";
export const ROUGHDRAFT_BIND_HOST = "127.0.0.1";
export const ROUGHDRAFT_LOOPBACK_HOSTS = ["127.0.0.1", "::1"] as const;
export const ROUGHDRAFT_PUBLIC_HOST = "localhost";

export const ROUGHDRAFT_BIND_HOST_ENV = "ROUGHDRAFT_BIND_HOST";

export function resolveBindHosts(
  env: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const raw = env[ROUGHDRAFT_BIND_HOST_ENV];

  if (raw === undefined) {
    return ROUGHDRAFT_LOOPBACK_HOSTS;
  }

  const hosts = raw
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  if (hosts.length === 0) {
    return ROUGHDRAFT_LOOPBACK_HOSTS;
  }

  return hosts;
}
