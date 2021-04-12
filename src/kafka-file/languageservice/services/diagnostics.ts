import { Diagnostic, DiagnosticSeverity, Position, Range, TextDocument } from "vscode";
import { Block, BlockType, ConsumerBlock, KafkaFileDocument, ProducerBlock, Property } from "../parser/kafkaFileParser";

/**
 * Kafka file diagnostics support.
 */
export class KafkaFileDiagnostics {

    doDiagnostics(document: TextDocument, kafkaFileDocument: KafkaFileDocument): Diagnostic[] {
        const diagnostcis: Diagnostic[] = [];
        for (const block of kafkaFileDocument.blocks) {
            if (block.type === BlockType.consumer) {
                this.validateConsumerBlock(<ConsumerBlock>block, diagnostcis);
            } else {
                this.validateProducerBlock(<ProducerBlock>block, diagnostcis);
            }
        }
        return diagnostcis;
    }

    validateConsumerBlock(block: ConsumerBlock, diagnostcis: Diagnostic[]) {
        // Validate properties
        this.validateProperties(block, diagnostcis);
    }

    validateProducerBlock(block: ProducerBlock, diagnostcis: Diagnostic[]) {
        // Validate properties
        this.validateProperties(block, diagnostcis);
    }

    validateProperties(block: Block, diagnostcis: Diagnostic[]) {
        let hasTopic = false;
        for (const property of block.properties) {
            this.validateProperty(property, block.allowedPropertyNames, diagnostcis);
            if (!hasTopic) {
                hasTopic = property.propertyName === 'topic';
            }
        }

        if (!hasTopic) {
            const range = new Range(block.start, new Position(block.start.line, block.start.character + 8));
            diagnostcis.push(new Diagnostic(range, 'Topic si required', DiagnosticSeverity.Error));
        }
    }
    validateProperty(property: Property, allowedPropertyNames: string[], diagnostcis: Diagnostic[]) {
        const name = property.propertyName;
        if (!name) {

        } else {
            if (allowedPropertyNames.indexOf(name + ':') === -1) {
                const range = property.propertyKeyRange;
                diagnostcis.push(new Diagnostic(range, 'Unkwown property', DiagnosticSeverity.Warning));
            } else {
                this.validatePropertyValue(property, diagnostcis);
            }
        }
    }
    validatePropertyValue(property: Property, diagnostcis: Diagnostic[]) {
        const name = property.propertyName;
        if (!name) {
            return;
        }
        switch (name) {
            case 'topic':
                break;
            case 'key-format':
                break;
            case 'value-format':
                break;
            case 'from':
                break;
            case 'partitions':
                break;
        }
    }
}


