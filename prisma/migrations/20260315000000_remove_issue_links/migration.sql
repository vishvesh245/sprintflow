-- DropForeignKey
ALTER TABLE "IssueLink" DROP CONSTRAINT "IssueLink_sourceIssueId_fkey";

-- DropForeignKey
ALTER TABLE "IssueLink" DROP CONSTRAINT "IssueLink_targetIssueId_fkey";

-- DropTable
DROP TABLE "IssueLink";

-- DropEnum
DROP TYPE "IssueLinkType";
