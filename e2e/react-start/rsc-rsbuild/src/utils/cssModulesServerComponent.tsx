import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { CssModulesContent } from './CssModulesContent'

export const getCssModulesServerComponent = createServerFn({ method: 'GET' })
  .inputValidator((data: { title?: string }) => data)
  .handler(async ({ data }) => {
    return renderServerComponent(
      <>
        {import.meta.rspackRsc.loadCss()}
        <CssModulesContent data={data} />
      </>
    )
  })
