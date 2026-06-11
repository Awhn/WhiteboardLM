"""프런트엔드 zustand persist 상태와 1:1로 맞춘 전송 스키마."""

from pydantic import BaseModel, Field


class DynamicFieldDTO(BaseModel):
    id: str
    label: str
    type: str
    options: list[str] | None = None
    value: str = ""


class DeclarationDTO(BaseModel):
    purpose: str = ""
    dynamicFields: list[DynamicFieldDTO] = Field(default_factory=list)


class WorkspaceDTO(BaseModel):
    id: str
    name: str
    type: str
    declaration: DeclarationDTO = Field(default_factory=DeclarationDTO)
    content: str = ""
    position: dict = Field(default_factory=dict)
    size: dict = Field(default_factory=dict)
    accessGranted: bool | None = None


class EdgeDTO(BaseModel):
    id: str
    source: str
    target: str
    type: str
    hopLimit: int = 1
    disabled: bool | None = None


class ChecklistItemDTO(BaseModel):
    id: str
    workspaceId: str
    title: str
    tag: str
    status: str
    assignee: str | None = None
    relatedWorkspaceId: str | None = None
    comments: list[dict] = Field(default_factory=list)
    activityLog: list[dict] = Field(default_factory=list)


class SnapshotDTO(BaseModel):
    id: str
    workspaceId: str
    checklistItemId: str
    content: str = ""
    createdAt: str


class BoardStateDTO(BaseModel):
    """localStorage('whiteboardlm-board')의 state와 동일한 형태."""

    workspaces: list[WorkspaceDTO] = Field(default_factory=list)
    edges: list[EdgeDTO] = Field(default_factory=list)
    pointer: dict = Field(default_factory=dict)
    checklistItems: list[ChecklistItemDTO] = Field(default_factory=list)
    snapshots: list[SnapshotDTO] = Field(default_factory=list)
    boardLog: list[dict] = Field(default_factory=list)


class GenerateFieldsRequest(BaseModel):
    name: str
    type: str
    purpose: str


class GenerateChecklistRequest(BaseModel):
    name: str
    type: str
    purpose: str
    dynamicFields: list[DynamicFieldDTO] = Field(default_factory=list)


class ExecuteItemRequest(BaseModel):
    title: str
    workspaceName: str
    purpose: str
    comment: str | None = None
    context: str | None = None
    toolResult: str | None = None
    blockResolved: bool = False
