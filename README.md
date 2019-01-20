# lol-client-api

Lots of things that are good to have for some people who play League of Legends

## Initial setup

- Copy `config.js.template` to `config.js`, and edit if needed
- Configure plugins (see below)
- Launch: `node bin/cli.js`

## Documentation

See JSDoc for documentation on stuff.

### `autoRunes` plugin

Automatically sets the contents of one rune page based on what champion is
selected during champion select.

#### Setting up

- Add a new rune page, and name it "auto (none)" (case sensitive). This will be
  the rune page which will automatically be updated.
- Add rune pages in `runes/{championName}.json`. For example, a rune page for
  Kai'Sa would be named `runes/Kai'Sa.json`. See below for format.
- Add the `autoRunes` plugin to `config.js`.

#### Rune page format

The `autoRunes` plugin will automatically convert rune names to their respective
ids. A full list of runes (Arcane Comet, Ravenous Hunter, etc) and rune styles
(Domination, Sorcery, etc) can be found in `gamedata/{version}/perks.json` and
`gamedata/{version}/perkStyles.json`, respectively, after the first run.

JSON files for rune pages should have 3 keys:

- `primaryStyleId`, containing the name of the primary path (eg Sorcery)
- `subStyleId`, containing the name of the secondary path (eg Domination)
- `selectedPerkIds`, containing all of the runes in order

Rune ordering should be done as following:
(Examples are for Domination/Sorcery)

- Keystone rune (eg Electrocute)
- The 2nd, 3rd, and 4th runes of the primary path from top to bottom (eg Cheap
  Shot, Eyeball Collection, Ravenous Hunter)
- The 1st and 2nd runes of the secondary path from top to bottom (eg Manaflow
  Band, Gathering Storm)
- The Offense, Flex, and Defense runes in order from top to bottom (eg
  AttackSpeed, Armor, HealthScaling), see below for names

Offense/Flex/Defense runes, in order:

- Offense: `Adaptive`, `AttackSpeed`, `CDRScaling`
- Flex: `Adaptive`, `Armor`, `MagicRes`
- Defense: `HealthScaling`, `Armor`, `MagicRes`

A full example:

```json
{
    "primaryStyleId": "Precision",
    "selectedPerkIds": [
        "Fleet Footwork",
        "Triumph",
        "Legend: Alacrity",
        "Coup de Grace",
        "Celerity",
        "Gathering Storm",
        "AttackSpeed",
        "Armor",
        "HealthScaling"
    ],
    "subStyleId": "Sorcery"
}
```
