import { beforeEach, describe, expect, test } from "bun:test"
import { activeCompany, addCompany, checkCompany, companies, removeCompany } from "./companies"

const good = {
  name: "Classical Visas",
  apiBase: "/cv-api",
  issuer: "https://id.classicalvisas.example/application/o/boltrig",
  clientId: "abc123",
}

beforeEach(() => localStorage.clear())

describe("companies", () => {
  test("starts with the built-in company only", () => {
    expect(companies().map((company) => company.id)).toEqual(["boltrig-dev"])
    expect(activeCompany().id).toBe("boltrig-dev")
  })

  test("adds a company, normalising the issuer and the API base", () => {
    const added = addCompany({ ...good, apiBase: "/cv-api/" })
    expect(typeof added).toBe("object")
    expect(companies().map((company) => company.id)).toEqual(["boltrig-dev", "classical-visas"])
    const stored = companies()[1]!
    expect(stored.issuer.endsWith("/")).toBe(true)
    expect(stored.apiBase).toBe("/cv-api")
  })

  test("refuses a duplicate name and bad fields", () => {
    expect(typeof addCompany(good)).toBe("object")
    expect(addCompany(good)).toBe("exists")
    expect(checkCompany({ ...good, name: "  " })).toBe("name")
    expect(checkCompany({ ...good, apiBase: "http://insecure.example" })).toBe("apiBase")
    expect(checkCompany({ ...good, apiBase: "javascript:alert(1)" })).toBe("apiBase")
    expect(checkCompany({ ...good, issuer: "http://id.example/" })).toBe("issuer")
    expect(checkCompany({ ...good, clientId: " " })).toBe("clientId")
  })

  test("cannot replace the built-in company by adding one with its name", () => {
    expect(addCompany({ ...good, name: "boltrig dev" })).toBe("exists")
  })

  test("removing a company drops it and its session", () => {
    addCompany(good)
    sessionStorage.setItem("boltrig.session.classical-visas", "x")
    removeCompany("classical-visas")
    expect(companies().map((company) => company.id)).toEqual(["boltrig-dev"])
    expect(sessionStorage.getItem("boltrig.session.classical-visas")).toBeNull()
  })

  test("ignores stored entries that are not well formed", () => {
    localStorage.setItem("boltrig.companies", JSON.stringify([{ id: "x" }, "bad", good]))
    expect(companies().map((company) => company.id)).toEqual(["boltrig-dev"])
  })
})
