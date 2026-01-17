"use client"

export function CreditsSection() {
  return (
    <section className="max-w-[1600px] mx-auto px-8 mt-16 border-t border-border pt-8">
      <h2 className="text-2xl font-semibold text-foreground mb-6">クレジット</h2>

      <div className="space-y-6 text-lg text-foreground">
        <div>
          <div className="text-sm font-semibold tracking-wide text-muted-foreground">素材提供サイト</div>
          <div className="mt-2 space-y-1">
            <div>
              <a
                href="https://illust-stock.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-primary/80 transition-colors duration-200"
              >
                イラストストック
              </a>
              &nbsp;様
            </div>
            <div>
              <a
                href="https://soundeffect-lab.info/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:text-primary/80 transition-colors duration-200"
              >
                効果音ラボ
              </a>
              &nbsp;様
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold tracking-wide text-muted-foreground">Special Thanks</div>
          <div className="mt-2">
            <a
              href="https://ytyping.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:text-primary/80 transition-colors duration-200"
            >
              YTyping
            </a>
            &nbsp;様
          </div>
        </div>
      </div>
    </section>
  )
}
