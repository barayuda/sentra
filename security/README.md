# Dependency audit policy

**Classification: INTERNAL**

`pnpm audit --audit-level=high` runs on every push. Any advisory at `high` or
above that is not in `audit-allowlist.json` fails the build.

## Accepting an advisory

An entry buys you time, not silence. Add to `accepted`:

    {
      "id": "<identifier exactly as pnpm audit reports it>",
      "module": "<affected package name>",
      "reason": "<why this is acceptable right now, and what the plan is>",
      "expires": "YYYY-MM-DD"
    }

The gate fails once `expires` has passed, **whether or not the advisory is
still reported**. That is deliberate: an entry that outlives its deadline is a
decision nobody has revisited, and the build is the only place that reliably
asks.

Set `expires` to the date by which you will have upgraded, replaced, or
consciously re-accepted the dependency. Ninety days is a reasonable default;
longer needs a reason in `reason`.

## What this does not prove

`pnpm audit` reports what its registry's advisory database knows today. It is
a floor under supply-chain risk, not a guarantee. Named risk area: supply chain.
