# Gist Schema

Each configuration section is compromised of a single gist with multiple files, where the key or id of the gist is the description of the gist


cursorsync.general
  --> devices.json
  
  ```JSON
  {
  "created": "12312123123123",
  "devices": [
    {
      "gistID": "62abc99b1cbdda72f1f937a637e49d7f2d84fcc317019ee69db98b486275f09f",
      "deviceID": "62abc99b1cbdda72f1f937a637e49d7f2d84fcc317019ee69db98b486275f09f",
      "isMaster": false,
      "label": "Foobar",
      "fileName":"Foobar.json",
      "lastSync": "1747403710616"
    }
  ],
  "lastUpdate": "12312123123123"
}
  ```
  --> settings.json
  
  ```JSON
  {"created":"1747403710616"}
  ```

cursorsync.devices
  --> device.json
  ```json
  {
  "created": "123123123132",
  "deviceId": "62abc99b1cbdda72f1f937a637e49d7f2d84fcc317019ee69db98b486275f09f",
  "deviceLabel": "Foobar",
  "lastSync": "",
  "settings": {}
}
  ```

cursorsync.extensions
  --> profile.json
  ```json
  {
  "created": "1747403711462",
  "extensions": [],
  "profile": "original",
  "tags": [
    "original"
  ]
}
  ```



## Extension Settings

> description: CursorSync.Conf

-> config.json - Used to store the persistent extension settings [Has not been fleshed out yet, and is for later added configuration, at the moment it is just a placeholder]

-> ref.json - a reference of all of the gists and the master indicator
ex:

```JSON
"ref":{
    "settings":[{
        "url":"github.com",
        "deviceName":"Tester",
        "master":0
    }],
    "extensions":...
}
```

## Machine Specific User Settings

> description: CursorSync.Device.<DeviceName>

-> metadata.json

```JSON
{
  "schemaVersion": "1.0",
  "deviceId": "dev-1234-abcd",
  "deviceName": "Work Laptop",
  "createdAt": "2025-05-01T00:00:00Z",
  "lastSync": "2025-05-12T12:34:56Z"
}
```

-> history.json (history of settings changes to this profile)

```JSON
{
  "schemaVersion": "1.0",
  "entries": [
    {
      "timestamp": "2025-05-12T12:34:56Z",
      "operation": "sync",
      "source": "manual",
      "changes": {
        "added": { "editor.fontSize": 14 },
        "modified": {
          "editor.tabSize": { "from": 2, "to": 4 }
        },
        "removed": ["unused.setting"]
      },
      "backupGistId": "qrst7890..." // reference to backup
    }
  ]
}
```

-> preferences.json (device specific settings, or configurations)

-> settings.json (Actual Cursor Settings)

## Extension Settings

> description: CursorSync.Exts.<ProfileName>

-> extensions.json

-> metadata.json

```JSON
{
  "schemaVersion": "1.0",
  "profileName": "Frontend",
  "description": "Extensions for frontend development",
  "createdAt": "2025-05-01T00:00:00Z",
  "lastModified": "2025-05-12T12:34:56Z",
  "modifiedBy": "dev-1234-abcd",
  "tags": ["javascript", "typescript", "react"]
}
```
