-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoleCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeIv" TEXT NOT NULL,
    "codeCipher" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleCode_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationIv" TEXT,
    "locationCipher" TEXT,
    "lastLocationAt" DATETIME,
    CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByRole" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetRole" TEXT,
    "message" TEXT NOT NULL,
    "isPanic" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Alert_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleCode_codeHash_key" ON "RoleCode"("codeHash");

-- CreateIndex
CREATE INDEX "RoleCode_roomId_roleType_idx" ON "RoleCode"("roomId", "roleType");

-- CreateIndex
CREATE INDEX "Participant_roomId_roleType_lastLocationAt_idx" ON "Participant"("roomId", "roleType", "lastLocationAt");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_roomId_roleType_deviceId_key" ON "Participant"("roomId", "roleType", "deviceId");
