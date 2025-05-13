from pydantic import BaseModel, Field

class ParamSchema(BaseModel):
    print(f'BaseModel {BaseModel}')
    inline: int = Field(ge=0, description="Inline offset", default=None)
    aperture: float = Field(ge=0, description="Aperture size", default=None)
    
    class Config:
        # Allow the fields to be None if not provided
        orm_mode = True
        min_anystr_length = 1
