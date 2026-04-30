import { describe, expect, it } from "vitest";
import {
  ROUGHDRAFT_BIND_HOST_ENV,
  ROUGHDRAFT_LOOPBACK_HOSTS,
  resolveBindHosts,
} from "./network";

describe("resolveBindHosts", () => {
  it("returns the default loopback list when the env var is unset", () => {
    expect(resolveBindHosts({})).toEqual(ROUGHDRAFT_LOOPBACK_HOSTS);
  });

  it("returns a single host when the env var names one host", () => {
    expect(
      resolveBindHosts({ [ROUGHDRAFT_BIND_HOST_ENV]: "0.0.0.0" }),
    ).toEqual(["0.0.0.0"]);
  });

  it("returns multiple hosts from a comma-separated value", () => {
    expect(
      resolveBindHosts({ [ROUGHDRAFT_BIND_HOST_ENV]: "0.0.0.0,::" }),
    ).toEqual(["0.0.0.0", "::"]);
  });

  it("trims whitespace around comma-separated hosts", () => {
    expect(
      resolveBindHosts({
        [ROUGHDRAFT_BIND_HOST_ENV]: " 127.0.0.1 , ::1 ",
      }),
    ).toEqual(["127.0.0.1", "::1"]);
  });

  it("falls back to the loopback list when the env var is an empty string", () => {
    expect(
      resolveBindHosts({ [ROUGHDRAFT_BIND_HOST_ENV]: "" }),
    ).toEqual(ROUGHDRAFT_LOOPBACK_HOSTS);
  });

  it("falls back to the loopback list when the env var is only commas and whitespace", () => {
    expect(
      resolveBindHosts({ [ROUGHDRAFT_BIND_HOST_ENV]: " , , " }),
    ).toEqual(ROUGHDRAFT_LOOPBACK_HOSTS);
  });
});
